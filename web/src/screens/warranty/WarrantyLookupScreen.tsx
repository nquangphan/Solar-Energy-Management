// hand-authored — web app-screen (Story 5.9). Tra cứu bảo hành: the staffer types
// the phone number of the customer who is ON THE LINE, and gets back which items
// of which orders are still under warranty.
//
// EVERYTHING NUMERIC ARRIVES COMPUTED (QĐ-4, AD-2). The screen does no date
// arithmetic and never derives a status: `warrantyEndAt`, `remainingDays`,
// `remainingMonths` and `warrantyStatus` all come from the backend, which owns the
// single implementation of "start + N months". A `switch` over `warrantyStatus` is
// the CORRECT shape here — mapping a server answer to a colour and a label.
//
// It never normalises the phone either (AD-9): the raw string goes out as typed.
//
// READ-ONLY (FR-36, Phase 1): no warranty claim, no lifecycle, no reminder. The
// screen shows the state `sap_het`; it does not notify anyone about it.
import { useState, type FormEvent } from 'react';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Frame,
  Skeleton,
  Table,
} from '../../design-system/components';
import { formatWarrantyMonths } from '../../design-system/components/CartLineRow';
import { filterNav } from '../../design-system/gating/permissions';
import type {
  WarrantyLine,
  WarrantyLookup,
  WarrantyPort,
} from '../../design-system/session/warranty-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Sidebar, SIDEBAR_NAV, Topbar, WebShell } from '../../design-system/shell';
import { formatNgay } from './format-ngay';

import './warranty-lookup.css';

export interface WarrantyLookupScreenProps {
  port: WarrantyPort;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/** How much is left, in the largest unit that still says something true.
 *
 * `formatWarrantyMonths` prints ONE unit and treats 0 as "0 năm" — so a line
 * with three weeks left, which is exactly the line the staffer is on the phone
 * about, would read "Còn 0 năm". Below a whole month the sentence switches to
 * the day count the backend already sent. NO arithmetic happens here: every
 * number is picked, never computed (QĐ-4).
 *
 * TWIN of `_conLai()` in the Flutter screen — the wording is byte-identical on
 * both platforms and pinned by parity.test.mjs. */
function conLai(line: WarrantyLine): string {
  if (line.remainingMonths >= 1) return `Còn ${formatWarrantyMonths(line.remainingMonths)}`;
  if (line.remainingDays > 0) return `Còn ${line.remainingDays} ngày`;
  // `remainingDays === 0` is the expiry day itself, and the line IS still
  // covered — "Còn 0 ngày" would read as expired.
  return 'Hết hạn hôm nay';
}

/** Chip colour + label per status. `het_han` renders a FIXED string: a duration
 * formatter has no sensible output for an expired line, and the mockup itself
 * only prints "Hết hạn". */
function nhanTrangThai(line: WarrantyLine): { label: string; mau: string } {
  switch (line.warrantyStatus) {
    case 'het_han':
      return { label: 'Hết hạn', mau: 'var(--danger)' };
    case 'sap_het':
      return { label: conLai(line), mau: 'var(--warn)' };
    case 'con_han':
    default:
      // Same sentence as `sap_het` — the two differ only in colour, which is why
      // the colour is read from the status and never guessed from the numbers.
      return { label: conLai(line), mau: 'var(--ok)' };
  }
}

export function WarrantyLookupScreen({ port }: WarrantyLookupScreenProps) {
  const { perms } = usePermissions();

  const [sdt, setSdt] = useState('');
  const [ketQua, setKetQua] = useState<WarrantyLookup | null>(null);
  const [state, setState] = useState<LoadState>('idle');
  const [loi, setLoi] = useState('');

  async function tra(raw: string): Promise<void> {
    setState('loading');
    try {
      // The RAW string, exactly as typed — the backend owns the only normaliser.
      const kq = await port.lookup(raw);
      setKetQua(kq);
      setState('ready');
    } catch (e) {
      // The backend's own words, verbatim: the client owns no rule about what a
      // valid phone is, so it owns no wording for one either.
      setLoi(e instanceof Error ? e.message : 'Không tra cứu được bảo hành.');
      setState('error');
    }
  }

  function guiForm(e: FormEvent): void {
    e.preventDefault();
    void tra(sdt);
  }

  const donCoBaoHanh = ketQua?.orders ?? [];

  return (
    <WebShell
      url="app.phuongnamsolar.vn/bao-hanh"
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="warranty" />}
      topbar={<Topbar eyebrow="HỖ TRỢ KHÁCH" title="Tra cứu bảo hành" />}
    >
      <div className="bh-wrap">
        <form className="bh-tra" onSubmit={guiForm}>
          <Field
            label="SĐT khách"
            placeholder="0903 176 968"
            value={sdt}
            onChange={(e) => setSdt(e.target.value)}
          />
          <Button type="submit">Tra cứu</Button>
        </form>

        {state === 'loading' && (
          <div className="bh-state">
            <Skeleton />
          </div>
        )}

        {state === 'idle' && (
          <EmptyState
            icon="ic-phone"
            title="Nhập số điện thoại khách để tra cứu bảo hành."
          />
        )}

        {state === 'error' && (
          <ErrorState message={loi} onRetry={() => void tra(sdt)} retryLabel="Thử lại" />
        )}

        {state === 'ready' && ketQua !== null && !ketQua.found && (
          <EmptyState icon="ic-phone" title="SĐT chưa có trong hệ thống." />
        )}

        {state === 'ready' && ketQua !== null && ketQua.found && (
          <>
            <Card variant="teal">
              <div className="bh-khach">
                <strong>{ketQua.customer?.name}</strong>
                <span className="micro">{ketQua.sdt}</span>
              </div>
            </Card>

            {donCoBaoHanh.length === 0 && (
              <EmptyState
                icon="ic-phone"
                title="Khách này chưa có vật tư nào còn theo dõi bảo hành."
              />
            )}

            {donCoBaoHanh.map((don) => (
              <Frame key={don.id} label={`Đơn ${don.id} · chốt ${formatNgay(don.chotAt)}`}>
                <Table>
                  <thead>
                    <tr>
                      <th>Vật tư</th>
                      <th className="num">SL</th>
                      <th>Bảo hành</th>
                      <th>Hết hạn</th>
                      <th>Còn lại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {don.lineItems.map((line) => {
                      const nhan = nhanTrangThai(line);
                      return (
                        <tr key={line.id}>
                          <td className="strong">{line.name}</td>
                          <td className="num mono">
                            {line.qty} {line.unit}
                          </td>
                          <td>{formatWarrantyMonths(line.warrantyMonths)}</td>
                          <td className="mono">{formatNgay(line.warrantyEndAt)}</td>
                          <td>
                            <span className="chip bh-chip" style={{ color: nhan.mau }}>
                              {nhan.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </Frame>
            ))}
          </>
        )}
      </div>
    </WebShell>
  );
}
