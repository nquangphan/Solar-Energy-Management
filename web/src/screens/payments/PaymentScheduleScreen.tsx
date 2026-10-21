// hand-authored — web app-screen (Story 7.1). Lịch thanh toán: view the order's
// payment schedule and (re)configure it as installments, each a percent of the
// order total or an amount, with a condition note.
//
// THE CLIENT COMPUTES NOTHING (AD-2/AD-10/AD-16). Each installment's amount, the
// schedule total, the order total after VAT, the difference and whether they
// match are the backend's answer. Quick templates only fill in the numbers a user
// would type (20 / 70 / 10) — they never produce a money figure.
//
// A blank number input is SENT ABSENT, never as 0: the backend then answers
// "exactly one of percent / amount". A typed "0" is sent as 0 and the backend
// refuses it (first installment = deposit, never 0).
//
// The edit button needs BOTH the backend's `editable` (order confirmed, not
// closed) and `payments.record` — UX only, the backend enforces both.
//
// Recording payments, paid/unpaid status and the debt-progress block belong to the
// next story; this screen shows the schedule only.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Frame,
  Money,
  Skeleton,
  Table,
} from '../../design-system/components';
import { PERMISSION_KEYS } from '../../design-system/gating/permission-keys.generated';
import { can, filterNav } from '../../design-system/gating/permissions';
import type {
  Installment,
  InstallmentInput,
  PaymentSchedule,
  PaymentsPort,
  PaymentsPortError,
} from '../../design-system/session/payments-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Seg, Sidebar, SIDEBAR_NAV, Topbar, WebShell } from '../../design-system/shell';

import './payment-schedule.css';

export interface PaymentScheduleScreenProps {
  port: PaymentsPort;
  orderId: string;
  onBack?: () => void;
}

type LoadState = 'loading' | 'ready' | 'error';
type Kind = 'percent' | 'amount';
type Template = '20/70/10' | '100%' | 'custom';

/**
 * One editable row: the raw input value (digits the user typed, or the number the
 * backend returned when an existing row is reopened) — never a computed figure.
 */
interface Row {
  key: number;
  kind: Kind;
  value: string | number;
  conditionNote: string;
}

const MAX_ROWS = 12;
const UNKNOWN_ERROR = 'Không lưu được lịch thanh toán. Vui lòng thử lại.';

const KIND_OPTIONS = [
  { key: 'percent', label: '%' },
  { key: 'amount', label: 'Số tiền' },
];

const TEMPLATE_ROWS: Record<Exclude<Template, 'custom'>, readonly [string, string][]> = {
  '20/70/10': [
  ['20', 'Cọc khi ký hợp đồng'],
  ['70', 'Khi thi công'],
    ['10', 'Khi nghiệm thu, bàn giao'],
  ],
  '100%': [['100', 'Thanh toán toàn bộ']],
};
const TEMPLATE_BUTTONS: readonly [Template, string][] = [
  ['20/70/10', '20/70/10'],
  ['100%', '100%'],
  ['custom', 'Tuỳ chỉnh'],
];

function digitsOnly(text: string): string {
  return text.replace(/\D/g, '');
}

function milestoneSuffix(milestone: Installment['milestone']): string {
  if (milestone === 'coc') return ' · Cọc';
  if (milestone === 'tat_toan') return ' · Tất toán';
  return '';
}

function toPortError(e: unknown): PaymentsPortError {
  if (
    typeof e === 'object' &&
    e !== null &&
    !(e instanceof Error) &&
    typeof (e as { message?: unknown }).message === 'string'
  ) {
    return e as PaymentsPortError;
  }
  return { code: 'UNKNOWN', message: UNKNOWN_ERROR };
}

/** Row ⇒ request item. Blank stays ABSENT (never 0); the note is sent as typed. */
function toInput(row: Row): InstallmentInput {
  const number = row.value === '' ? {} : { [row.kind]: Number(row.value) };
  return { ...number, conditionNote: row.conditionNote };
}

export function PaymentScheduleScreen({ port, orderId, onBack }: PaymentScheduleScreenProps) {
  const { perms } = usePermissions();
  const [state, setState] = useState<LoadState>('loading');
  const [schedule, setSchedule] = useState<PaymentSchedule | null>(null);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [template, setTemplate] = useState<Template>('custom');
  const [error, setError] = useState<PaymentsPortError | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const nextKey = useRef(0);

  const newRow = (kind: Kind, value: string | number, conditionNote: string): Row => {
    nextKey.current += 1;
    return { key: nextKey.current, kind, value, conditionNote };
  };

  const load = useCallback(async () => {
    setState('loading');
    try {
      setSchedule(await port.getSchedule(orderId));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [port, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEditing = (current: PaymentSchedule) => {
    setRows(
      current.installments.length === 0
        ? [newRow('percent', '', '')]
        : current.installments.map((i) =>
            i.percent !== null
              ? newRow('percent', i.percent, i.conditionNote)
              : newRow('amount', i.amount, i.conditionNote),
          ),
    );
    setTemplate('custom');
    setError(null);
    setEditing(true);
  };

  /** "Tuỳ chỉnh" keeps the rows being edited; a quick template replaces them. */
  const applyTemplate = (next: Template) => {
    setTemplate(next);
    if (next === 'custom') return;
    setRows(TEMPLATE_ROWS[next].map(([value, note]) => newRow('percent', value, note)));
    // Field errors are keyed by row index: a new row set would show them on the wrong rows.
    setError(null);
  };

  const updateRow = (index: number, patch: Partial<Row>) =>
    setRows((current) => current.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const reload = async () => {
    setEditing(false);
    setError(null);
    await load();
  };

  const save = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const saved = await port.replaceSchedule(orderId, { installments: rows.map(toInput) });
      setSchedule(saved);
      setEditing(false);
    } catch (e) {
      setError(toPortError(e));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const rowErrors = (index: number, fields: readonly string[]) =>
    (error?.fieldErrors ?? []).filter((f) =>
      fields.some((name) => f.field === `installments.${index}.${name}`),
    );
  const generalErrors = (error?.fieldErrors ?? []).filter(
    (f) => !/^installments\.\d+\./.test(f.field),
  );

  const canEdit =
    schedule !== null && schedule.editable && can(perms, PERMISSION_KEYS.paymentsRecord);

  return (
    <WebShell
      url={`app.phuongnamsolar.vn/don-hang/${orderId}/thanh-toan`}
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="orders" />}
      topbar={<Topbar eyebrow="CÔNG NỢ" title="Lịch thanh toán" onBack={onBack} />}
    >
      <div className="ps-wrap">
        {state === 'loading' && (
          <div className="ps-state">
            <Skeleton />
            <Skeleton />
          </div>
        )}

        {state === 'error' && (
          <ErrorState
            message="Không tải được lịch thanh toán."
            onRetry={() => void load()}
            retryLabel="Thử lại"
          />
        )}

        {state === 'ready' && schedule !== null && !editing && !schedule.configured && (
          <EmptyState
            icon="ic-payment"
            title="Đơn chưa có lịch thanh toán."
            action={
              canEdit ? (
                <Button variant="primary" onClick={() => startEditing(schedule)}>
                  Cấu hình lịch
                </Button>
              ) : undefined
            }
          />
        )}

        {state === 'ready' && schedule !== null && !editing && schedule.configured && (
          <>
            {!schedule.totalMatches && (
              <Banner tone="warn" icon="ic-alert" role="alert">
                Tổng các đợt lệch tổng đơn sau VAT <Money value={schedule.difference} />
              </Banner>
            )}
            <Frame label="Các đợt thanh toán">
              <Table>
                <thead>
                  <tr>
                    <th>Đợt</th>
                    <th>Điều kiện</th>
                    <th>Tỉ lệ</th>
                    <th className="num">Số tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.installments.map((i) => (
                    <tr key={i.seq}>
                      <td className="strong">
                        Đợt {i.seq}
                        {milestoneSuffix(i.milestone)}
                      </td>
                      <td>{i.conditionNote}</td>
                      <td>{i.percent !== null ? `${i.percent}%` : '—'}</td>
                      <td className="num">
                        <Money value={i.amount} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Frame>
            <div className="ps-totals">
              <div className="ps-total">
                <span className="micro muted">Tổng lịch</span>
                <Money value={schedule.scheduledTotal} />
              </div>
              <div className="ps-total">
                <span className="micro muted">Tổng đơn (sau VAT)</span>
                <Money value={schedule.orderTotal} />
              </div>
            </div>
            {canEdit && (
              <div>
                <Button variant="primary" onClick={() => startEditing(schedule)}>
                  Sửa lịch
                </Button>
              </div>
            )}
          </>
        )}

        {state === 'ready' && schedule !== null && editing && (
          <div className="ps-form">
            <div className="ps-templates">
              {TEMPLATE_BUTTONS.map(([key, label]) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={template === key ? 'primary' : 'default'}
                  aria-pressed={template === key}
                  onClick={() => applyTemplate(key)}
                >
                  {label}
                </Button>
              ))}
            </div>

            {rows.map((row, index) => (
              <div key={row.key} className="ps-row">
                <div className="ps-row-head">
                  <span className="strong">Đợt {index + 1}</span>
                  <Seg
                    options={KIND_OPTIONS}
                    activeKey={row.kind}
                    onSelect={(k) => {
                      if (k === row.kind) return;
                      // A number typed as a percent is not an amount (20% ≠ 20 đồng): start blank.
                      updateRow(index, { kind: k as Kind, value: '' });
                      setTemplate('custom');
                    }}
                  />
                  <span className="ps-spacer" />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={rows.length <= 1}
                    onClick={() => {
                      setRows(rows.filter((_, j) => j !== index));
                      setTemplate('custom');
                      setError(null);
                    }}
                  >
                    Xoá đợt
                  </Button>
                </div>
                <div className="ps-row-fields">
                  <Field
                    label={row.kind === 'percent' ? 'Tỉ lệ (%)' : 'Số tiền (đồng)'}
                    inputMode="numeric"
                    value={row.value}
                    onChange={(e) => updateRow(index, { value: digitsOnly(e.target.value) })}
                  />
                  <Field
                    label="Điều kiện"
                    value={row.conditionNote}
                    maxLength={200}
                    onChange={(e) => updateRow(index, { conditionNote: e.target.value })}
                  />
                </div>
                {rowErrors(index, ['percent', 'amount', 'conditionNote']).map((f) => (
                  <div key={f.field + f.code} className="micro ps-error">
                    {f.message}
                  </div>
                ))}
              </div>
            ))}

            {rows.length < MAX_ROWS && (
              <div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setRows([...rows, newRow('percent', '', '')]);
                    setTemplate('custom');
                  }}
                >
                  Thêm đợt
                </Button>
              </div>
            )}

            {error !== null && (
              <Banner tone="danger" icon="ic-alert" role="alert">
                {error.message}
                {generalErrors.map((f) => (
                  <div key={f.field + f.code}>{f.message}</div>
                ))}
                {error.code === 'CONFLICT' && (
                  <div>
                    <Button type="button" size="sm" onClick={() => void reload()}>
                      Tải lại
                    </Button>
                  </div>
                )}
              </Banner>
            )}

            <div className="ps-actions">
              <Button
                type="button"
                variant="primary"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? 'Đang lưu…' : 'Lưu lịch'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
              >
                Huỷ
              </Button>
            </div>
          </div>
        )}
      </div>
    </WebShell>
  );
}
