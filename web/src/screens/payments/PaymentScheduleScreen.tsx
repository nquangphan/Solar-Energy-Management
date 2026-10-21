// hand-authored — web app-screen (Stories 7.1–7.2). Lịch thanh toán: view the
// order's payment schedule and (re)configure it as installments, each a percent of
// the order total or an amount, with a condition note; see what has been collected
// and record a payment against one installment.
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
// Recording a payment is consequential (money + an automatic status change), so it
// goes through a ConfirmDialog. The idempotency key is generated ONCE when the form
// opens and re-sent on every retry; a new key only after a success or a close.
// Paid / remaining / status figures are the backend's; the "Ghi nhận" button needs
// the backend's `recordable` AND `payments.record` — UX only, the backend enforces.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Frame,
  Money,
  Skeleton,
  Table,
} from '../../design-system/components';
import { STATUS_LABELS, type StatusKey } from '../../design-system/components/StatusChip';
import { PERMISSION_KEYS } from '../../design-system/gating/permission-keys.generated';
import { can, filterNav } from '../../design-system/gating/permissions';
import type {
  AutoTransitionResult,
  Installment,
  InstallmentInput,
  PaymentMethod,
  PaymentSchedule,
  PaymentStatus,
  PaymentsPort,
  PaymentsPortError,
  RecordPaymentInput,
} from '../../design-system/session/payments-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Seg, Sidebar, SIDEBAR_NAV, Topbar, WebShell } from '../../design-system/shell';

import './payment-schedule.css';

export interface PaymentScheduleScreenProps {
  port: PaymentsPort;
  orderId: string;
  onBack?: () => void;
  /** Called with the new order status when a payment moved the order (outcome `applied`). */
  onOrderStatusChanged?: (status: string) => void;
  /** Idempotency-key source; tests inject a deterministic one. */
  newKey?: () => string;
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

/** The open "Ghi nhận thanh toán" form — raw inputs only, plus its idempotency key. */
interface RecordForm {
  installment: Installment;
  amount: string | number;
  paidOn: string;
  method: PaymentMethod;
  note: string;
  key: string;
  /** An attempt of this form already failed — its payment may have been recorded anyway. */
  failedAttempt: boolean;
}

const MAX_ROWS = 12;
const UNKNOWN_ERROR = 'Không lưu được lịch thanh toán. Vui lòng thử lại.';
const UNKNOWN_RECORD_ERROR = 'Không ghi nhận được thanh toán. Vui lòng thử lại.';

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
const METHOD_OPTIONS: { key: PaymentMethod; label: string }[] = [
  { key: 'bank_transfer', label: 'Chuyển khoản' },
  { key: 'cash', label: 'Tiền mặt' },
];
const METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Chuyển khoản',
  cash: 'Tiền mặt',
};
const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: 'Đã thu',
  partial: 'Thu một phần',
  unpaid: 'Chưa thu',
};
const RECORD_FIELDS = ['amount', 'paidOn'];

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

/** `YYYY-MM-DD` ⇒ `dd/MM` (presentation only). */
function dayMonth(paidOn: string): string {
  return `${paidOn.slice(8, 10)}/${paidOn.slice(5, 7)}`;
}

/**
 * Today in Vietnam (UTC+7) as `YYYY-MM-DD` — the default payment date. The backend refuses a
 * date after today IN VIETNAM, so the device's own timezone must not decide the default.
 */
function todayIso(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status as StatusKey] ?? status;
}

function toPortError(e: unknown, fallback = UNKNOWN_ERROR): PaymentsPortError {
  if (
    typeof e === 'object' &&
    e !== null &&
    !(e instanceof Error) &&
    typeof (e as { message?: unknown }).message === 'string'
  ) {
    return e as PaymentsPortError;
  }
  return { code: 'UNKNOWN', message: fallback };
}

/** Row ⇒ request item. Blank stays ABSENT (never 0); the note is sent as typed. */
function toInput(row: Row): InstallmentInput {
  const number = row.value === '' ? {} : { [row.kind]: Number(row.value) };
  return { ...number, conditionNote: row.conditionNote };
}

/** Form ⇒ request. A blank amount stays ABSENT (never 0); a blank note is not sent. */
function toRecordInput(form: RecordForm): RecordPaymentInput {
  return {
    idempotencyKey: form.key,
    installmentId: form.installment.id,
    ...(form.amount === '' ? {} : { amount: Number(form.amount) }),
    paidOn: form.paidOn,
    method: form.method,
    ...(form.note.trim() === '' ? {} : { note: form.note }),
  };
}

const defaultNewKey = () => crypto.randomUUID();

export function PaymentScheduleScreen({
  port,
  orderId,
  onBack,
  onOrderStatusChanged,
  newKey = defaultNewKey,
}: PaymentScheduleScreenProps) {
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
  const [recordForm, setRecordForm] = useState<RecordForm | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<PaymentsPortError | null>(null);
  const [outcome, setOutcome] = useState<
    (AutoTransitionResult & { orderStatus: string }) | null
  >(null);

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
    setRecordForm(null);
    setRecordError(null);
    await load();
  };

  /**
   * A NEW key per opened form; retries of this form keep it. Pressing "Ghi nhận" again on the
   * installment whose form is already open keeps that form and its key: after a lost response
   * a fresh key would let the same payment be recorded twice.
   */
  const openRecord = (installment: Installment) => {
    if (recordForm !== null && recordForm.installment.id === installment.id) return;
    setRecordForm({
      installment,
      amount: installment.remainingAmount,
      paidOn: todayIso(),
      method: 'bank_transfer',
      note: '',
      key: newKey(),
      failedAttempt: false,
    });
    setRecordError(null);
    setOutcome(null);
  };

  const updateRecord = (patch: Partial<RecordForm>) =>
    setRecordForm((current) => (current === null ? current : { ...current, ...patch }));

  const submitRecord = async () => {
    if (recordForm === null || inFlight.current) return;
    inFlight.current = true;
    setRecording(true);
    setRecordError(null);
    try {
      const result = await port.recordPayment(orderId, toRecordInput(recordForm));
      setSchedule(result.schedule);
      setRecordForm(null);
      setOutcome(
        result.autoTransition === null
          ? null
          : { ...result.autoTransition, orderStatus: result.orderStatus },
      );
      // A retry after a failed attempt may be the replay of a payment whose response was lost:
      // the replay carries no autoTransition, so the current status is reported as well.
      if (result.autoTransition?.outcome === 'applied' || recordForm.failedAttempt) {
        onOrderStatusChanged?.(result.orderStatus);
      }
    } catch (e) {
      updateRecord({ failedAttempt: true });
      setRecordError(toPortError(e, UNKNOWN_RECORD_ERROR));
    } finally {
      inFlight.current = false;
      setRecording(false);
    }
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
  const canRecord =
    schedule !== null && schedule.recordable && can(perms, PERMISSION_KEYS.paymentsRecord);
  const recordFieldErrors = (field: string) =>
    (recordError?.fieldErrors ?? []).filter((f) => f.field === field);
  const recordGeneralErrors = (recordError?.fieldErrors ?? []).filter(
    (f) => !RECORD_FIELDS.includes(f.field),
  );

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
            {outcome?.outcome === 'applied' && (
              <Banner tone="info" icon="ic-check" role="status">
                Đơn đã chuyển sang {statusLabel(outcome.orderStatus)}.
              </Banner>
            )}
            {outcome?.outcome === 'skipped' && (
              <Banner tone="warn" icon="ic-alert" role="status">
                Đã ghi nhận tiền. Trạng thái đơn chưa đổi: {outcome.message}
              </Banner>
            )}
            <Frame label="Tiến độ công nợ">
              <div className="ps-debt">
                <div className="ps-total">
                  <span className="micro muted">Đã thu</span>
                  <Money value={schedule.paidTotal} />
                </div>
                <div className="ps-total">
                  <span className="micro muted">Còn lại</span>
                  <Money value={schedule.remainingTotal} />
                </div>
                <div className="ps-total">
                  <span className="micro muted">Tiến độ</span>
                  <span className="strong">{schedule.paidPercent}% / 100%</span>
                </div>
                <div className="ps-total">
                  <span className="micro muted">Tổng đơn</span>
                  <Money value={schedule.orderTotal} />
                </div>
              </div>
            </Frame>
            <Frame label="Các đợt thanh toán">
              <Table>
                <thead>
                  <tr>
                    <th>Đợt</th>
                    <th>Điều kiện</th>
                    <th>Tỉ lệ</th>
                    <th className="num">Số tiền</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.installments.map((i) => (
                    <tr key={i.seq}>
                      <td className="strong">
                        Đợt {i.seq}
                        {milestoneSuffix(i.milestone)}
                        {i.payments.map((p) => (
                          <div key={p.id} className="micro muted">
                            Thu {dayMonth(p.paidOn)} · {METHOD_LABELS[p.method]} ·{' '}
                            <Money value={p.amount} />
                          </div>
                        ))}
                      </td>
                      <td>{i.conditionNote}</td>
                      <td>{i.percent !== null ? `${i.percent}%` : '—'}</td>
                      <td className="num">
                        <Money value={i.amount} />
                      </td>
                      <td>
                        <div className="ps-status">
                          <span className={`chip ps-chip ps-chip--${i.status}`}>
                            {PAYMENT_STATUS_LABELS[i.status]}
                          </span>
                          {canRecord && i.status !== 'paid' && (
                            <Button
                              type="button"
                              size="sm"
                              disabled={recording}
                              onClick={() => openRecord(i)}
                            >
                              Ghi nhận
                            </Button>
                          )}
                        </div>
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
            {recordForm !== null && (
              <Frame label={`Ghi nhận thanh toán · Đợt ${recordForm.installment.seq}`}>
                <div className="ps-form">
                  <Field
                    label="Số tiền thu"
                    inputMode="numeric"
                    value={recordForm.amount}
                    onChange={(e) => updateRecord({ amount: digitsOnly(e.target.value) })}
                  />
                  {recordFieldErrors('amount').map((f) => (
                    <div key={f.field + f.code} className="micro ps-error">
                      {f.message}
                    </div>
                  ))}
                  <Field
                    label="Ngày thu"
                    type="date"
                    value={recordForm.paidOn}
                    onChange={(e) => updateRecord({ paidOn: e.target.value })}
                  />
                  {recordFieldErrors('paidOn').map((f) => (
                    <div key={f.field + f.code} className="micro ps-error">
                      {f.message}
                    </div>
                  ))}
                  <div className="ps-row-head">
                    <span className="micro muted">Phương thức</span>
                    <Seg
                      options={METHOD_OPTIONS}
                      activeKey={recordForm.method}
                      onSelect={(k) => updateRecord({ method: k as PaymentMethod })}
                    />
                  </div>
                  <Field
                    label="Ghi chú"
                    value={recordForm.note}
                    maxLength={200}
                    onChange={(e) => updateRecord({ note: e.target.value })}
                  />
                  {recordError !== null && (
                    <Banner tone="danger" icon="ic-alert" role="alert">
                      {recordError.message}
                      {recordGeneralErrors.map((f) => (
                        <div key={f.field + f.code}>{f.message}</div>
                      ))}
                      {recordError.code === 'CONFLICT' && (
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
                      disabled={recording || recordForm.amount === ''}
                      onClick={() => setConfirming(true)}
                    >
                      {recording ? 'Đang ghi nhận…' : `Ghi nhận đợt ${recordForm.installment.seq}`}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={recording}
                      onClick={() => {
                        setRecordForm(null);
                        setRecordError(null);
                      }}
                    >
                      Huỷ
                    </Button>
                  </div>
                </div>
              </Frame>
            )}
            {recordForm !== null && (
              <ConfirmDialog
                open={confirming}
                title={`Ghi nhận thanh toán · Đợt ${recordForm.installment.seq}`}
                confirmLabel="Ghi nhận"
                consequence={
                  <>
                    Ghi nhận <Money value={Number(recordForm.amount)} />
                    {` cho Đợt ${recordForm.installment.seq}?`}
                    {recordForm.installment.milestone === 'coc' && (
                      <div>Khi đủ đợt cọc, đơn sẽ tự chuyển sang Đã cọc.</div>
                    )}
                  </>
                }
                onCancel={() => setConfirming(false)}
                onConfirm={() => {
                  setConfirming(false);
                  void submitRecord();
                }}
              />
            )}
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
