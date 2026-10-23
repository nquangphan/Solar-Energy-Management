// hand-authored — web app-screen (Story 8.2). Phân quyền & tài khoản: the account
// list, and the permission checklist of the selected account with "Áp preset role".
//
// WHO MAY GRANT/EDIT WHAT ARRIVES COMPUTED (AD-2): `grantable` per permission,
// `editable` + `readOnlyReason` per account, and only the presets the caller can
// grant in full. The screen displays them and holds no escalation rule of its own.
// Applying a preset only loads its values into the draft; nothing is sent until Lưu.
// The dependency warning reads each permission's `requires` from the backend; the
// backend refuses the same gaps with a 400 anyway.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Banner,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Frame,
  Sheet,
  Skeleton,
} from '../../design-system/components';
import { filterNav } from '../../design-system/gating/permissions';
import type {
  AccountPermissionSummary,
  AccountsPort,
  PermissionOption,
  PermissionOptions,
  RolePresetOption,
} from '../../design-system/session/accounts-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Sidebar, SIDEBAR_NAV, Topbar, WebShell } from '../../design-system/shell';

import './permissions.css';

export interface PermissionsScreenProps {
  port: AccountsPort;
}

type LoadState = 'loading' | 'ready' | 'error';

/**
 * One sentence per permission lacking what it requires — same wording and order as the
 * backend `dependencyMessage` (gaps by key, missing keys by key).
 */
export function dependencyWarnings(options: readonly PermissionOption[], draft: ReadonlySet<string>): string[] {
  const labels = new Map(options.map((o) => [o.key, o.label]));
  return options
    .filter((o) => draft.has(o.key))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((o) => ({
      option: o,
      missing: o.requires.filter((key) => !draft.has(key)).sort(),
    }))
    .filter(({ missing }) => missing.length > 0)
    .map(
      ({ option, missing }) =>
        `«${option.label}» cần thêm ${missing.map((key) => `«${labels.get(key) ?? key}»`).join(', ')}.`,
    );
}

export function PermissionsScreen({ port }: PermissionsScreenProps) {
  const { perms } = usePermissions();
  const [state, setState] = useState<LoadState>('loading');
  const [accounts, setAccounts] = useState<AccountPermissionSummary[]>([]);
  const [options, setOptions] = useState<PermissionOptions | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);

  // A reload that arrives after a newer one must not paint over it.
  const loadTicket = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++loadTicket.current;
    setState('loading');
    try {
      const [list, opts] = await Promise.all([port.listAccounts(), port.getPermissionOptions()]);
      if (ticket !== loadTicket.current) return;
      setAccounts(list);
      setOptions(opts);
      setState('ready');
    } catch {
      if (ticket !== loadTicket.current) return;
      setState('error');
    }
  }, [port]);

  useEffect(() => {
    void load();
  }, [load]);

  const select = (account: AccountPermissionSummary) => {
    // Switching account drops the unsaved draft of the previous one.
    setSelectedId(account.id);
    setDraft(new Set(account.permissions));
    setSaveError(null);
  };

  const applyPreset = (preset: RolePresetOption) => {
    setDraft(new Set(preset.permissions));
    setSaveError(null);
    setPresetsOpen(false);
  };

  const toggle = (key: string, checked: boolean) => {
    setDraft((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const selected = accounts.find((a) => a.id === selectedId) ?? null;
  const warnings = options ? dependencyWarnings(options.permissions, draft) : [];
  const readOnly = selected !== null && !selected.editable;
  const canSave = selected !== null && !readOnly && warnings.length === 0 && !saving;

  const save = async () => {
    if (!selected || !options) return;
    const id = selected.id;
    const permissions = options.permissions.map((o) => o.key).filter((key) => draft.has(key));
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await port.updatePermissions(id, permissions);
      setAccounts((list) => list.map((a) => (a.id === id ? saved : a)));
      setDraft(new Set(saved.permissions));
    } catch (error) {
      // The backend sentence (403 self/escalation, 400 dependency…); the ticks stay as they are.
      setSaveError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <WebShell
      url="app.phuongnamsolar.vn"
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="permissions" />}
      topbar={<Topbar eyebrow="QUẢN TRỊ" title="Phân quyền & tài khoản" />}
    >
      <div className="perm-wrap">
        {state === 'loading' && (
          <div className="perm-grid">
            <Skeleton height={220} />
            <Skeleton height={320} />
          </div>
        )}

        {state === 'error' && (
          <ErrorState message="Không tải được danh sách tài khoản." onRetry={load} retryLabel="Thử lại" />
        )}

        {state === 'ready' && accounts.length === 0 && (
          <EmptyState icon="ic-permissions" title="Chưa có tài khoản nào." />
        )}

        {state === 'ready' && options && accounts.length > 0 && (
          <div className="perm-grid">
            <Frame label="Tài khoản" className="perm-accounts">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  className="perm-account"
                  aria-pressed={account.id === selectedId}
                  // No switching while a save is in flight: its reply (or refusal) belongs to
                  // the account on screen.
                  disabled={saving}
                  onClick={() => select(account)}
                >
                  <b>{account.displayName}</b>
                  <span className="micro muted">{account.phone ?? account.email}</span>
                  <span className="micro muted">{account.matchingPresetLabel ?? 'Tuỳ chỉnh'}</span>
                  {!account.isActive && <span className="micro perm-inactive">Đã vô hiệu</span>}
                </button>
              ))}
            </Frame>

            {selected === null ? (
              <EmptyState icon="ic-permissions" title="Chọn một tài khoản để xem quyền." />
            ) : (
              <Card variant="teal">
                <div className="perm-card-head">
                  <span className="micro">Quyền của account</span>
                  <b>{selected.displayName}</b>
                  <span className="ktype">{selected.matchingPresetLabel ?? 'Tuỳ chỉnh'}</span>
                  <span className="perm-spacer" />
                  <Button
                    variant="accent"
                    size="sm"
                    type="button"
                    disabled={readOnly || options.presets.length === 0}
                    onClick={() => setPresetsOpen(true)}
                  >
                    Áp preset role
                  </Button>
                  <Button variant="primary" size="sm" type="button" disabled={!canSave} onClick={() => void save()}>
                    Lưu
                  </Button>
                </div>
                <div className="perm-card-body">
                  {readOnly ? (
                    <Banner tone="warn" icon="ic-alert">
                      {selected.readOnlyReason}
                    </Banner>
                  ) : (
                    <Banner tone="info">
                      Áp preset chỉ <b>nạp giá trị mặc định</b>. Sau đó tick/bỏ từng quyền — bộ quyền lưu trên account
                      là nguồn chân lý.
                    </Banner>
                  )}
                  {warnings.length > 0 && (
                    <Banner tone="warn" icon="ic-alert" role="alert">
                      {warnings.map((w) => (
                        <div key={w}>{w}</div>
                      ))}
                    </Banner>
                  )}
                  {saveError !== null && (
                    <Banner tone="danger" icon="ic-alert" role="alert">
                      {saveError}
                    </Banner>
                  )}
                  <div className="perm-checklist">
                    {options.permissions.map((option) => (
                      <Checkbox
                        key={option.key}
                        label={option.label}
                        checked={draft.has(option.key)}
                        disabled={readOnly || !option.grantable}
                        onChange={(checked) => toggle(option.key, checked)}
                      />
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      <Sheet open={presetsOpen} onClose={() => setPresetsOpen(false)} title="Áp preset role">
        <div className="perm-presets">
          {(options?.presets ?? []).map((preset) => (
            <Button key={preset.key} type="button" size="wide" onClick={() => applyPreset(preset)}>
              {preset.label}
            </Button>
          ))}
        </div>
      </Sheet>
    </WebShell>
  );
}
