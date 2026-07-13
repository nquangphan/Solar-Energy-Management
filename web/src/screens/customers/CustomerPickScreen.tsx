// hand-authored — web app-screen (Story 3.4). Tra SĐT ⇒ chọn khách cũ hoặc tạo
// khách mới NGAY TẠI MÀN, composed entirely from shipped design-system components
// (Card/Frame/Field/Button/Banner/CustomerTypeChip) + tokens (AD-13).
//
// THE CLIENT NEVER TOUCHES A PHONE NUMBER (AD-9). The raw string the user typed
// goes straight to the port; the backend normalises it, decides validity, and
// returns the E.164 key. There is no regex here, no length check, no format
// message — the one on screen is the one the backend sent (AD-5).
//
// Lookup fires on an EXPLICIT action (button / Enter), not per keystroke: the
// client may not judge whether a half-typed number is "long enough" to send, so
// per-key lookup would fire a request for `0`, `09`, `090`… each of them garbage.
//
// `onSelect(customer)` is the entire API this screen leaves for Story 4.1 — it
// does NOT navigate to an order (no order exists until Epic 4).
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import {
  Banner,
  Button,
  Card,
  CustomerTypeChip,
  Field,
  Frame,
} from '../../design-system/components';
import { filterNav } from '../../design-system/gating/permissions';
import type {
  Customer,
  CustomerLookup,
  CustomerPortError,
  CustomerSource,
  CustomersPort,
} from '../../design-system/session/customers-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Seg, Sidebar, SIDEBAR_NAV, Topbar, WebShell } from '../../design-system/shell';

import './customers.css';

export interface CustomerPickScreenProps {
  port: CustomersPort;
  /** Called with the chosen (or freshly created) customer. Story 4.1 passes the real one. */
  onSelect?: (customer: Customer) => void;
}

const CA_NHAN = 'CA_NHAN';
const THUONG_MAI = 'THUONG_MAI';

const TYPE_OPTIONS = [
  { key: CA_NHAN, label: 'Cá nhân' },
  { key: THUONG_MAI, label: 'Thương mại' },
];

/** Label of a customer type — the chip text, shared by all three screens. */
export function typeLabel(custType: string): string {
  return custType === THUONG_MAI ? 'Thương mại' : 'Cá nhân';
}

export function CustomerPickScreen({ port, onSelect }: CustomerPickScreenProps) {
  const { perms } = usePermissions();

  const [sdt, setSdt] = useState('');
  const [result, setResult] = useState<CustomerLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Create-form state.
  const [custType, setCustType] = useState<string>(CA_NHAN);
  const [name, setName] = useState('');
  const [cccd, setCccd] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [address, setAddress] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [sourceNote, setSourceNote] = useState('');
  const [sources, setSources] = useState<CustomerSource[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    port.listSources().then(setSources).catch(() => setSources([]));
  }, [port]);

  // `isOther` is read from the FLAG the backend sends — never by comparing the
  // source name to "Khác". Story 3.5 lets an admin rename a source, and a rule
  // must not collapse because someone edited a label.
  const chosenSource = sources.find((source) => source.id === sourceId);
  const needsSourceNote = chosenSource?.isOther === true;

  async function handleLookup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(false);
    try {
      // The RAW string, exactly as typed. The backend owns every judgement about it.
      setResult(await port.lookup(sdt));
    } catch (err) {
      setResult(null);
      setError(messageOf(err));
    }
  }

  function openCreate() {
    setCreating(true);
    setFieldErrors({});
    setError(null);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    try {
      const created = await port.create({
        // Still the raw string — the backend re-normalises it into the key it stores.
        sdt,
        custType,
        name,
        cccd: custType === CA_NHAN && cccd !== '' ? cccd : undefined,
        taxCode: custType === THUONG_MAI && taxCode !== '' ? taxCode : undefined,
        address: address !== '' ? address : undefined,
        bankAccount:
          custType === THUONG_MAI && bankAccount !== '' ? bankAccount : undefined,
        sourceId,
        sourceNote: sourceNote !== '' ? sourceNote : undefined,
      });
      onSelect?.(created);
    } catch (err) {
      setError(messageOf(err));
      setFieldErrors(fieldErrorsOf(err));
    }
  }

  return (
    <WebShell
      url="app.phuongnamsolar.vn/khach-hang/tra-cuu"
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="customers" />}
      topbar={<Topbar eyebrow="KHÁCH HÀNG" title="Tra cứu theo số điện thoại" />}
    >
      <div className="cust-wrap">
        <Frame label="Tra cứu theo số điện thoại">
          <form onSubmit={handleLookup} noValidate>
            <Field
              label="SĐT"
              size="lg"
              value={sdt}
              onChange={(e) => setSdt(e.target.value)}
            />
            <div className="cust-actions">
              <Button variant="primary" type="submit">
                Tra cứu
              </Button>
            </div>
          </form>
        </Frame>

        {error && (
          <Banner tone="danger" icon="ic-alert" role="alert">
            {error}
          </Banner>
        )}

        {result?.found === true && result.customer !== null && !creating && (
          <Card variant="teal" className="cust-hit">
            <div className="cust-hit-head">
              <div className="cust-hit-title">Khách cũ — trùng khớp</div>
              <CustomerTypeChip>{typeLabel(result.customer.custType)}</CustomerTypeChip>
            </div>
            <CustomerFacts customer={result.customer} sources={sources} />
            <Button
              variant="primary"
              size="wide"
              type="button"
              onClick={() => onSelect?.(result.customer as Customer)}
            >
              Dùng khách này
            </Button>
            <Banner tone="info">
              <Button variant="ghost" type="button" onClick={openCreate}>
                Không phải khách này? Tạo khách hàng mới →
              </Button>
            </Banner>
          </Card>
        )}

        {result?.found === false && !creating && (
          <Card className="cust-miss">
            {/* The exact empty-state copy (UX-DR-19). EXPERIENCE.md forbids the
                generic no-results phrasing by name — a dead end is not an answer;
                the way forward is the button beneath it. */}
            <div className="cust-miss-msg">SĐT chưa có trong hệ thống.</div>
            <Button variant="primary" size="wide" type="button" onClick={openCreate}>
              Tạo khách hàng mới
            </Button>
          </Card>
        )}

        {creating && (
          <Frame label="Tạo khách hàng mới" className="cust-create">
            <form onSubmit={handleCreate} noValidate>
              <div className="cust-typerow">
                <span className="cust-label">Loại khách</span>
                <Seg options={TYPE_OPTIONS} activeKey={custType} onSelect={setCustType} />
              </div>

              <Field
                label={custType === THUONG_MAI ? 'Tên đơn vị' : 'Họ tên'}
                size="lg"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {fieldErrors.name && <Banner tone="danger">{fieldErrors.name}</Banner>}

              {/* Each type carries its OWN fields. Sending a `taxCode` with a Cá nhân
                  is a 400 from the backend — so the field simply is not offered. */}
              {custType === CA_NHAN ? (
                <>
                  <Field label="CCCD" size="lg" value={cccd} onChange={(e) => setCccd(e.target.value)} />
                  {fieldErrors.cccd && <Banner tone="danger">{fieldErrors.cccd}</Banner>}
                </>
              ) : (
                <>
                  <Field label="MST" size="lg" value={taxCode} onChange={(e) => setTaxCode(e.target.value)} />
                  {fieldErrors.taxCode && <Banner tone="danger">{fieldErrors.taxCode}</Banner>}
                </>
              )}

              <Field label="Địa chỉ" size="lg" value={address} onChange={(e) => setAddress(e.target.value)} />

              {custType === THUONG_MAI && (
                <>
                  <Field
                    label="Tài khoản NH"
                    size="lg"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                  />
                  {fieldErrors.bankAccount && <Banner tone="danger">{fieldErrors.bankAccount}</Banner>}
                </>
              )}

              <label className="cust-select">
                <span className="cust-label">Nguồn khách</span>
                {/* No default selection: the source is a real business fact, and a
                    pre-picked one would be the app answering a question the user
                    never did. */}
                <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                  <option value="" disabled>
                    — Chọn nguồn —
                  </option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </label>
              {fieldErrors.sourceId && <Banner tone="danger">{fieldErrors.sourceId}</Banner>}

              {needsSourceNote && (
                <>
                  <Field
                    label="Ghi rõ nguồn"
                    size="lg"
                    value={sourceNote}
                    onChange={(e) => setSourceNote(e.target.value)}
                  />
                  {fieldErrors.sourceNote && <Banner tone="danger">{fieldErrors.sourceNote}</Banner>}
                </>
              )}

              <div className="cust-actions">
                <Button variant="ghost" type="button" onClick={() => setCreating(false)}>
                  Huỷ
                </Button>
                <Button variant="primary" type="submit">
                  Lưu khách hàng
                </Button>
              </div>
            </form>
          </Frame>
        )}
      </div>
    </WebShell>
  );
}

/**
 * The `dl.kv` fact list — ONLY the fields that belong to this customer's type.
 * A Cá nhân has no MST and no bank account; rendering those rows empty would tell
 * the user a field exists for them when it does not.
 */
export function CustomerFacts({
  customer,
  sources,
}: {
  customer: Customer;
  sources: CustomerSource[];
}) {
  const source = sources.find((s) => s.id === customer.sourceId);
  const commercial = customer.custType === THUONG_MAI;
  return (
    <dl className="cust-kv">
      <dt>{commercial ? 'Tên đơn vị' : 'Họ tên'}</dt>
      <dd>{customer.name}</dd>
      {commercial ? (
        <>
          <dt>MST</dt>
          <dd>{orDash(customer.taxCode)}</dd>
        </>
      ) : (
        <>
          <dt>CCCD</dt>
          <dd>{orDash(customer.cccd)}</dd>
        </>
      )}
      <dt>Địa chỉ</dt>
      <dd>{orDash(customer.address)}</dd>
      <dt>SĐT (khoá chính)</dt>
      <dd className="cust-mono">{customer.sdt}</dd>
      {commercial && (
        <>
          <dt>Tài khoản NH</dt>
          <dd>{orDash(customer.bankAccount)}</dd>
        </>
      )}
      <dt>Nguồn khách</dt>
      <dd>{orDash(source?.name ?? null)}</dd>
      {source?.isOther === true && (
        <>
          <dt>Ghi rõ nguồn</dt>
          <dd>{orDash(customer.sourceNote)}</dd>
        </>
      )}
    </dl>
  );
}

/** An empty nullable field shows `—`: the row stays, so the user knows it is blank. */
export function orDash(value: string | null): string {
  return value === null || value === '' ? '—' : value;
}

/**
 * The message the BACKEND sent (AD-5). The client invents no format copy of its own —
 * the generic line is only for a transport failure, which carries no envelope.
 */
function messageOf(err: unknown): string {
  const envelope = err as Partial<CustomerPortError>;
  return envelope?.message ?? 'Không thực hiện được. Thử lại.';
}

/** `fieldErrors` from the AD-5 envelope, flattened onto the field they belong to. */
function fieldErrorsOf(err: unknown): Record<string, string> {
  const envelope = err as Partial<CustomerPortError>;
  const out: Record<string, string> = {};
  for (const item of envelope?.fieldErrors ?? []) {
    out[item.field] = item.message;
  }
  return out;
}
