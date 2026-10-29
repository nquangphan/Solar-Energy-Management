/**
 * Flat "before → after" diff of an audit record (FR-20). PURE DOMAIN: the client only displays
 * these rows, it never interprets the raw JSON (AD-1/AD-2).
 */

/** One changed leaf. `field` is its path (`status`, `lines[0].unitCost`); `''` for a bare scalar. */
export interface AuditChange {
  readonly field: string;
  readonly before: string | null;
  readonly after: string | null;
  /** The field holds an integer amount of money: the client renders it through its money formatter. */
  readonly isMoney: boolean;
}

/** Longest rendered value; the full value stays in the database. */
export const AUDIT_VALUE_MAX_LENGTH = 500;

/**
 * Field names that hold money in an audit payload, matched on the LAST key of a path. Must
 * contain every money field of the API contract (`design-system/money/money-fields.mjs` — a
 * design-system guard compares the two) plus the money fields that only exist inside event
 * payloads.
 */
export const AUDIT_MONEY_FIELDS: ReadonlySet<string> = new Set([
  // Money fields of the API contract.
  'afterDiscount',
  'amount',
  'cost',
  'costPrice',
  'difference',
  'discountAmount',
  'grossProfit',
  'orderTotal',
  'paidAmount',
  'paidTotal',
  'price',
  'remainingAmount',
  'remainingTotal',
  'revenue',
  'scheduledTotal',
  'subtotal',
  'total',
  'unitCost',
  'unitPrice',
  'vatAmount',
  // Money fields found only in event payloads.
  'giaVonSau',
  'giaVonTruoc',
  'installmentPaid',
  'orderPaid',
]);

/**
 * Cost fields, matched on the LAST key of a path. Payloads keep them (the audit records the
 * truth), but a reader without `costs.view` never sees them — the same rule the catalog
 * (`stripCostPrice`) and stock vouchers apply to their responses.
 */
export const AUDIT_COST_FIELDS: ReadonlySet<string> = new Set([
  'costPrice',
  'giaVonSau',
  'giaVonTruoc',
  'unitCost',
]);

type PlainObject = Record<string, unknown>;

/** A leaf value and the object key that names it (`unitCost` for `lines[0].unitCost`). */
interface Leaf {
  readonly key: string;
  readonly value: unknown;
}

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmptyContainer(value: unknown): boolean {
  return (
    (Array.isArray(value) && value.length === 0) ||
    (isPlainObject(value) && Object.keys(value).length === 0)
  );
}

function collectLeaves(
  value: unknown,
  path: string,
  key: string,
  out: Map<string, Leaf>,
): void {
  if (Array.isArray(value) && value.length > 0) {
    value.forEach((item, i) => collectLeaves(item, `${path}[${i}]`, key, out));
  } else if (isPlainObject(value) && Object.keys(value).length > 0) {
    for (const [k, v] of Object.entries(value))
      collectLeaves(v, path === '' ? k : `${path}.${k}`, k, out);
  } else {
    out.set(path, { key, value });
  }
}

/** Every leaf of a payload by path; an absent payload or an empty root has none. */
function leaves(payload: unknown): Map<string, Leaf> {
  const out = new Map<string, Leaf>();
  if (payload === undefined || payload === null || isEmptyContainer(payload))
    return out;
  collectLeaves(payload, '', '', out);
  return out;
}

function render(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : JSON.stringify(value);
  return text.length > AUDIT_VALUE_MAX_LENGTH
    ? `${text.slice(0, AUDIT_VALUE_MAX_LENGTH)}…`
    : text;
}

/**
 * Both payloads are flattened to leaf paths (`kWp`, `lines[0].unitCost`, `[1].price`; a bare
 * scalar is the path `''`), so money nested in lists still gets its own row and its money flag.
 * Rows follow the leaf order of `after`, then the paths only in `before`; a path is kept when the
 * two sides serialise differently or one side lacks it. An absent side (create/delete event)
 * renders `null`. Without `canViewCosts`, cost leaves are dropped before diffing.
 */
export function auditChanges(
  before: unknown,
  after: unknown,
  canViewCosts: boolean,
): AuditChange[] {
  const b = leaves(before);
  const a = leaves(after);
  const paths = [...a.keys(), ...[...b.keys()].filter((path) => !a.has(path))];
  const rows: AuditChange[] = [];
  for (const path of paths) {
    const was = b.get(path);
    const now = a.get(path);
    const key = now?.key ?? was?.key ?? '';
    if (!canViewCosts && AUDIT_COST_FIELDS.has(key)) continue;
    if (
      was !== undefined &&
      now !== undefined &&
      JSON.stringify(was.value) === JSON.stringify(now.value)
    )
      continue;
    rows.push({
      field: path,
      before: render(was?.value),
      after: render(now?.value),
      isMoney: AUDIT_MONEY_FIELDS.has(key),
    });
  }
  return rows;
}
