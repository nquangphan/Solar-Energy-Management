// hand-authored — web app-screen (Story 8.3). Tạo / sửa tài khoản (mockup s-account-form).
//
// Create: name, sign-in phone, email, initial password, role preset, active flag. The
// preset is only a key — the backend loads its permission set (AD-8); fine-tuning happens
// in the Phân quyền matrix right after. Edit: the same profile fields, no password and no
// preset (permissions are edited in the matrix).
//
// The client checks only that fields are filled. The phone goes out RAW as typed (the
// backend normalizes it, AD-9) and the password policy is the backend's: its 400/409
// `fieldErrors` land under the matching input, every typed value stays.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  ScopeFlag,
  Sheet,
  Skeleton,
} from '../../design-system/components';
import { filterNav } from '../../design-system/gating/permissions';
import type { AccountsPort, AccountsPortError, RolePresetOption } from '../../design-system/session/accounts-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Sidebar, SIDEBAR_NAV, Topbar, WebShell } from '../../design-system/shell';

import './permissions.css';

export interface AccountFormScreenProps {
  port: AccountsPort;
  /** Absent ⇒ create; present ⇒ edit that account. */
  accountId?: string;
  /** After a successful save, with the saved account's id. */
  onDone: (accountId: string) => void;
  onCancel: () => void;
}

type LoadState = 'loading' | 'ready' | 'error' | 'unavailable';

interface FormValues {
  displayName: string;
  phone: string;
  email: string;
  password: string;
  isActive: boolean;
}

/** The inputs both modes render, by the backend's field name. */
const PROFILE_FIELDS = ['displayName', 'phone', 'email'];

const EMPTY_FORM: FormValues = { displayName: '', phone: '', email: '', password: '', isActive: true };

export function AccountFormScreen({ port, accountId, onDone, onCancel }: AccountFormScreenProps) {
  const { perms } = usePermissions();
  const editing = accountId !== undefined;
  const [state, setState] = useState<LoadState>('loading');
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [presets, setPresets] = useState<RolePresetOption[]>([]);
  const [preset, setPreset] = useState<RolePresetOption | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<AccountsPortError | null>(null);

  // A load that arrives after a newer one (another account opened) must not paint over it.
  const loadTicket = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++loadTicket.current;
    setState('loading');
    setError(null);
    try {
      if (accountId === undefined) {
        const options = await port.getPermissionOptions();
        if (ticket !== loadTicket.current) return;
        setPresets(options.presets);
        setPreset(null);
        setForm(EMPTY_FORM);
      } else {
        // No `GET /accounts/:id`: the list the Phân quyền screen reads already has it.
        const account = (await port.listAccounts()).find((a) => a.id === accountId);
        if (ticket !== loadTicket.current) return;
        if (account === undefined || !account.editable) {
          setUnavailableReason(account?.readOnlyReason ?? null);
          setState('unavailable');
          return;
        }
        setForm({
          displayName: account.displayName,
          phone: account.phone ?? '',
          email: account.email,
          password: '',
          isActive: account.isActive,
        });
      }
      setState('ready');
    } catch {
      if (ticket !== loadTicket.current) return;
      setState('error');
    }
  }, [port, accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const filled =
    form.displayName.trim() !== '' &&
    form.phone.trim() !== '' &&
    form.email.trim() !== '' &&
    (editing || (form.password !== '' && preset !== null));
  const canSave = state === 'ready' && filled && !saving;

  const save = async () => {
    // A click is a discrete event: React re-renders (Lưu disabled) before a second one lands.
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const profile = {
      displayName: form.displayName,
      phone: form.phone,
      email: form.email,
      isActive: form.isActive,
    };
    try {
      const saved =
        accountId === undefined
          ? await port.createAccount({ ...profile, password: form.password, preset: preset!.key })
          : await port.updateAccount(accountId, profile);
      onDone(saved.id);
    } catch (err) {
      // The backend's words; every typed value stays in the form.
      setError(err as AccountsPortError);
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (field: string) => error?.fieldErrors?.find((e) => e.field === field)?.message;
  // A refusal naming no input on screen (403, 404, or a field the form does not show) goes in the banner.
  const shownFields = editing ? PROFILE_FIELDS : [...PROFILE_FIELDS, 'password', 'preset'];
  const formError =
    error !== null && !(error.fieldErrors ?? []).some((e) => shownFields.includes(e.field)) ? error.message : null;
  const errorUnder = (field: string) => {
    const message = fieldError(field);
    return message === undefined ? null : <span className="acct-field-error">{message}</span>;
  };

  return (
    <WebShell
      url={editing ? 'app.phuongnamsolar.vn/phan-quyen/sua' : 'app.phuongnamsolar.vn/phan-quyen/tao'}
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="permissions" />}
      topbar={
        <Topbar
          eyebrow="QUẢN TRỊ · ACCOUNT"
          title={editing ? 'Sửa tài khoản' : 'Tạo tài khoản mới'}
          // No leaving while a save is in flight: its reply decides where we land.
          onBack={saving ? undefined : onCancel}
        />
      }
    >
      <div className="acct-wrap">
        {state === 'loading' && <Skeleton height={360} />}

        {state === 'error' && (
          <ErrorState
            message={editing ? 'Không tải được tài khoản.' : 'Không tải được danh sách preset.'}
            onRetry={load}
            retryLabel="Thử lại"
          />
        )}

        {state === 'unavailable' && (
          <>
            <ErrorState message="Không sửa được tài khoản này." />
            {unavailableReason !== null && (
              <Banner tone="warn" icon="ic-alert">
                {unavailableReason}
              </Banner>
            )}
          </>
        )}

        {state === 'ready' && !editing && presets.length === 0 && (
          <EmptyState icon="ic-permissions" title="Bạn không cấp được preset nào." />
        )}

        {state === 'ready' && (
          <Card className="acct-card">
            {formError !== null && (
              <Banner tone="danger" icon="ic-alert" role="alert">
                {formError}
              </Banner>
            )}
            <div>
              <Field
                label="Họ tên"
                value={form.displayName}
                autoComplete="name"
                onChange={(e) => set('displayName', e.target.value)}
              />
              {errorUnder('displayName')}
            </div>
            <div>
              <Field
                label="Số điện thoại (dùng đăng nhập)"
                className="mono"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
              {errorUnder('phone')}
            </div>
            <div>
              <Field
                label="Email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
              {errorUnder('email')}
            </div>
            {!editing && (
              <div>
                <Field
                  label="Mật khẩu ban đầu"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                />
                <span className="micro muted">Tối thiểu 8 ký tự, có chữ và số.</span>
                {errorUnder('password')}
              </div>
            )}
            {!editing && (
              <div className="fgroup">
                <span className="flabel">Role preset</span>
                <Button
                  type="button"
                  className="acct-preset"
                  disabled={presets.length === 0}
                  onClick={() => setPresetsOpen(true)}
                >
                  {preset?.label ?? 'Chọn preset'}
                </Button>
                {errorUnder('preset')}
              </div>
            )}
            <div className="fgroup">
              <span className="flabel">Trạng thái kích hoạt</span>
              {/* ScopeFlag only displays; the screen owns the choice, so each flag sits in a button. */}
              <div className="acct-flags">
                <button
                  type="button"
                  className="acct-flag"
                  aria-pressed={form.isActive}
                  onClick={() => set('isActive', true)}
                >
                  <ScopeFlag on={form.isActive}>{form.isActive ? '● Kích hoạt' : 'Kích hoạt'}</ScopeFlag>
                </button>
                <button
                  type="button"
                  className="acct-flag"
                  aria-pressed={!form.isActive}
                  onClick={() => set('isActive', false)}
                >
                  <ScopeFlag on={!form.isActive}>{form.isActive ? 'Tạm khoá' : '● Tạm khoá'}</ScopeFlag>
                </button>
              </div>
            </div>
            <Banner tone="info" icon="ic-info">
              Áp preset role sẽ <b>nạp bộ quyền mặc định</b> cho account. Muốn chỉnh thêm (tick/bỏ từng quyền) → làm ở
              màn <b>Phân quyền</b>.
            </Banner>
            <div className="acct-actions">
              <Button variant="ghost" type="button" disabled={saving} onClick={onCancel}>
                Huỷ
              </Button>
              <span className="perm-spacer" />
              <Button variant="primary" type="button" disabled={!canSave} onClick={() => void save()}>
                Lưu account
              </Button>
            </div>
          </Card>
        )}
      </div>

      <Sheet open={presetsOpen} onClose={() => setPresetsOpen(false)} title="Role preset">
        <div className="perm-presets">
          {presets.map((option) => (
            <Button
              key={option.key}
              type="button"
              size="wide"
              aria-pressed={option.key === preset?.key}
              onClick={() => {
                setPreset(option);
                setPresetsOpen(false);
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </Sheet>
    </WebShell>
  );
}
