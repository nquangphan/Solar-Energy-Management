/**
 * Raw SQL that writes one of `tables` (`$executeRaw\`UPDATE invoices …\``,
 * `$executeRawUnsafe('DELETE FROM "audit_logs" …')`, `TRUNCATE customer_sources`).
 *
 * Raw SQL lives inside template/string literals, which `stripToCode` empties, so the returned
 * pattern is meant for source passed through `stripComments` (strings kept, comments gone): a
 * docstring explaining the rule ("never UPDATE invoices") does not trip the guard.
 *
 * `delete` covers `DELETE FROM` and `TRUNCATE`. A table name only matches whole, optionally
 * quoted and schema-qualified: `invoices` never matches `invoice_pdfs`.
 */
export type SqlWrite = 'insert' | 'update' | 'delete';

const VERB: Record<SqlWrite, string> = {
  insert: 'INSERT\\s+INTO',
  update: 'UPDATE',
  delete: 'DELETE\\s+FROM|TRUNCATE(?:\\s+TABLE)?',
};

export function rawSqlWritePattern(
  tables: readonly string[],
  writes: readonly SqlWrite[] = ['insert', 'update', 'delete'],
): RegExp {
  const verbs = writes.map((w) => VERB[w]).join('|');
  return new RegExp(
    `\\b(?:${verbs})\\s+(?:ONLY\\s+)?(?:"?public"?\\s*\\.\\s*)?"?(?:${tables.join('|')})"?(?![\\w])`,
    'i',
  );
}
