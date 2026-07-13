// hand-authored — web app-screen (Story 3.5). Cấu hình nguồn khách: the catalogue
// an admin edits when the company opens a new channel, so nobody has to ship code
// to add "TikTok" to a dropdown.
//
// WEB-ONLY, by name (DESIGN.md): the one business screen with no mobile twin.
// Configuring a catalogue is desk work.
//
// The screen owns NO rule. It does not decide the sort order of a new row (the
// backend appends it), it does not decide whether a name is taken (the backend
// answers 409), and it does not decide that the flagged row cannot be switched off
// — it reads `isOther` off the row and disables the button, and the backend refuses
// the call regardless (AD-4). Everything the user sees after an error is the
// BACKEND's message, verbatim (AD-5): a second opinion invented here goes stale the
// day the server's rules move.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Banner,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Frame,
  ScopeFlag,
  Skeleton,
  Table,
} from '../../design-system/components';
import { filterNav } from '../../design-system/gating/permissions';
import type {
  CustomerSourcePortError,
  CustomerSourceRow,
  CustomerSourcesPort,
} from '../../design-system/session/customer-sources-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Sidebar, SIDEBAR_NAV, Topbar, WebShell } from '../../design-system/shell';

import './settings.css';

export interface CustomerSourceConfigScreenProps {
  port: CustomerSourcesPort;
}

type LoadState = 'loading' | 'ready' | 'error';

/** The form behind the Thêm/Sửa dialog. `editing` null = adding a new source. */
interface FormState {
  editing: CustomerSourceRow | null;
  name: string;
  description: string;
  sortOrder: string;
}

const EMPTY_FORM: FormState = { editing: null, name: '', description: '', sortOrder: '' };

/** Narrow an unknown rejection to the AD-5 envelope the port promises. */
function asPortError(err: unknown): CustomerSourcePortError {
  const envelope = err as CustomerSourcePortError;
  return typeof envelope?.message === 'string'
    ? envelope
    : { message: 'Không lưu được thay đổi.' };
}

export function CustomerSourceConfigScreen({ port }: CustomerSourceConfigScreenProps) {
  const { perms } = usePermissions();

  const [rows, setRows] = useState<CustomerSourceRow[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [form, setForm] = useState<FormState | null>(null);
  const [confirming, setConfirming] = useState<CustomerSourceRow | null>(null);
  const [error, setError] = useState<CustomerSourcePortError | null>(null);
  // A mutation is in flight. Without this, a double-click on Lưu fires port.create()
  // twice with the same name: the first succeeds, the second comes back 409 — and the
  // admin is told the name is taken on a screen where they just took it.
  const [busy, setBusy] = useState(false);

  // Edits and reloads race: a slow list() answer from before a rename can land AFTER
  // the reload that follows it, repainting the table with the row's OLD name. The
  // ticket makes the stale answer a no-op instead of a lie.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    setState('loading');
    try {
      // The config screen is the ONE caller that wants switched-off rows too — it is
      // where they get switched back on. The customer form asks for the other view.
      const catalogue = await port.list(true);
      if (ticket !== latest.current) return;
      setRows(catalogue);
      setState('ready');
    } catch {
      if (ticket !== latest.current) return;
      setState('error');
    }
  }, [port]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Run a mutation, then reload. Backend refusals surface as-is; nothing is invented here. */
  const mutate = useCallback(
    async (call: () => Promise<unknown>, onDone: () => void) => {
      setError(null);
      setBusy(true);
      try {
        await call();
        onDone();
        await load();
      } catch (err: unknown) {
        setError(asPortError(err));
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  /** Open the Thêm/Sửa dialog on a CLEAN slate — a refusal from the last attempt is not this one's. */
  const openForm = (next: FormState) => {
    setError(null);
    setForm(next);
  };

  const closeForm = () => {
    setError(null);
    setForm(null);
  };

  const save = () => {
    if (form === null) return;
    const description = form.description.trim() === '' ? null : form.description;
    // An empty box means "no number given" ⇒ the field is OMITTED and the backend
    // appends the row. It does NOT mean zero — sending 0 would jump it to the top.
    // The box only ever holds digits (onChange filters), so Number() cannot be NaN —
    // and a NaN would reach the port as JSON `null` and come back a puzzling 400.
    const sortOrder = form.sortOrder.trim() === '' ? undefined : Number(form.sortOrder);
    const editing = form.editing;
    void mutate(
      () =>
        editing === null
          ? port.create({ name: form.name, description, sortOrder })
          : port.update(editing.id, { name: form.name, description, sortOrder }),
      () => setForm(null),
    );
  };

  const fieldError = (field: string) =>
    error?.fieldErrors?.find((e) => e.field === field)?.message;

  return (
    <WebShell
      url="app.phuongnamsolar.vn/cau-hinh/nguon-khach"
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="settings" />}
      topbar={
        <Topbar
          eyebrow="CẤU HÌNH HỆ THỐNG"
          title="Nguồn khách hàng"
          action={
            <Button variant="primary" type="button" onClick={() => openForm(EMPTY_FORM)}>
              + Thêm nguồn
            </Button>
          }
        />
      }
    >
      <div className="set-wrap">
        <Banner tone="info">
          Mỗi nguồn có một câu mô tả để sale phân biệt lúc nhập — "Fanpage" và "Facebook" nghe
          giống nhau nhưng là hai kênh khác nhau. Đổi tên nguồn được ghi Audit.
        </Banner>

        {/* Only when NO dialog is open. A dialog paints over a fixed dimming scrim and is
            aria-modal, so a banner out here would sit BEHIND the modal and outside the
            modal's accessibility tree — invisible to eyes and to screen readers alike.
            While the form is open its copy of this banner renders inside the modal body;
            the confirm dialog closes itself before failing, which lands us back here. */}
        {error !== null && form === null && (
          <Banner tone="danger" role="alert">
            {error.message}
          </Banner>
        )}

        {state === 'loading' && (
          <div className="set-state">
            <Skeleton />
            <div className="set-state-msg">Đang tải danh mục nguồn khách…</div>
          </div>
        )}

        {state === 'error' && (
          <ErrorState
            message="Không tải được danh mục nguồn khách."
            onRetry={load}
            retryLabel="Thử lại"
          />
        )}

        {state === 'ready' && rows.length === 0 && (
          <EmptyState
            title="Chưa có nguồn khách nào"
            message="Thêm nguồn đầu tiên để sale ghi được khách đến từ đâu."
            action={
              <Button variant="primary" type="button" onClick={() => openForm(EMPTY_FORM)}>
                + Thêm nguồn
              </Button>
            }
          />
        )}

        {state === 'ready' && rows.length > 0 && (
          <Frame label="Danh mục nguồn · thứ tự hiện trên form">
            <Table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Tên nguồn</th>
                  <th>Mô tả cho người nhập</th>
                  <th>Trạng thái</th>
                  <th className="num">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="num set-mono">{row.sortOrder}</td>
                    <td>
                      <b>{row.name}</b>
                      {/* The flag is read off the row, never off the name — renaming this
                          row is allowed precisely because nothing keys off its label. */}
                      {row.isOther && <ScopeFlag on className="set-flag">Cờ "Khác"</ScopeFlag>}
                    </td>
                    <td>{row.description ?? '—'}</td>
                    <td>{row.active ? 'Đang dùng' : 'Đã tắt'}</td>
                    <td className="num">
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() =>
                          openForm({
                            editing: row,
                            name: row.name,
                            description: row.description ?? '',
                            sortOrder: String(row.sortOrder),
                          })
                        }
                      >
                        Sửa
                      </Button>
                      {row.isOther ? (
                        // Disabled, not hidden: the row's immunity is a FACT the admin
                        // should see, not a button that silently went missing.
                        <Button variant="ghost" size="sm" type="button" disabled>
                          Khoá
                        </Button>
                      ) : row.active ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => setConfirming(row)}
                        >
                          Tắt
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          disabled={busy}
                          onClick={() => void mutate(() => port.reactivate(row.id), () => {})}
                        >
                          Bật lại
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Frame>
        )}

        <Dialog
          open={form !== null}
          title={form?.editing === null ? 'Thêm nguồn khách' : 'Sửa nguồn khách'}
          onClose={closeForm}
          footer={
            <>
              <Button variant="ghost" type="button" onClick={closeForm}>
                Huỷ
              </Button>
              <Button variant="primary" type="button" onClick={save} disabled={busy}>
                Lưu
              </Button>
            </>
          }
        >
          <div className="set-form">
            {/* The refusal belongs where the user is looking and where the offending box
                is — inside the modal. Its message is the BACKEND's, verbatim (AD-5). */}
            {error !== null && (
              <Banner tone="danger" role="alert">
                {error.message}
              </Banner>
            )}
            <Field
              label="Tên nguồn"
              value={form?.name ?? ''}
              onChange={(e) => setForm((f) => (f === null ? f : { ...f, name: e.target.value }))}
            />
            {fieldError('name') !== undefined && (
              <div className="set-field-error">{fieldError('name')}</div>
            )}
            <Field
              label="Mô tả cho người nhập"
              value={form?.description ?? ''}
              onChange={(e) =>
                setForm((f) => (f === null ? f : { ...f, description: e.target.value }))
              }
            />
            <Field
              label="Thứ tự hiện trên form"
              inputMode="numeric"
              value={form?.sortOrder ?? ''}
              // `inputMode` is a keyboard HINT, not a filter — a real keyboard can still
              // type "3a". Keep only digits so the box can never hold something Number()
              // turns into NaN. This is input hygiene, not a business rule: the ceiling on
              // sortOrder stays the backend's to enforce (it answers 400 + fieldErrors).
              onChange={(e) =>
                setForm((f) =>
                  f === null ? f : { ...f, sortOrder: e.target.value.replace(/\D/g, '') },
                )
              }
            />
            {fieldError('sortOrder') !== undefined && (
              <div className="set-field-error">{fieldError('sortOrder')}</div>
            )}
          </div>
        </Dialog>

        {/* Switching a source off is a consequential action (EXPERIENCE §State Patterns):
            it changes what every future customer form offers. It states the consequence
            and asks — it is never a bare one-click. */}
        <ConfirmDialog
          open={confirming !== null}
          title="Tắt nguồn khách?"
          consequence="Khách cũ vẫn giữ nguồn này. Nguồn sẽ không còn hiện trên form tạo khách."
          confirmLabel="Tắt nguồn"
          cancelLabel="Huỷ"
          tone="danger"
          onConfirm={() => {
            const target = confirming;
            if (target === null) return;
            // CLOSE FIRST, then call. Two reasons, both real: a refusal (409, network) has
            // nowhere to show inside a ConfirmDialog — it renders only its `consequence` —
            // so a banner raised while it is open would hide behind its own scrim and the
            // admin would see a dead button and click it again. And a closed dialog has no
            // button left to double-click. Failing lands the message on the page banner.
            setConfirming(null);
            void mutate(() => port.deactivate(target.id), () => {});
          }}
          onCancel={() => {
            setError(null);
            setConfirming(null);
          }}
        />
      </div>
    </WebShell>
  );
}
