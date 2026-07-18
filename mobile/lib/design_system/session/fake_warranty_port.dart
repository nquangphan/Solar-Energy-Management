// hand-authored — TEST/DEMO-ONLY fake port (Story 5.9, mirror web
// web/src/design-system/session/fake-warranty-port.ts).
//
// NOT a real backend: an in-memory answer so the Tra cứu bảo hành screen is
// demoable/testable WITHOUT an app-runtime or network. It enforces NO business
// rule — phone normalisation, permission scoping and every warranty date live on
// the server (AD-4/AD-9).
//
// The dates here are FIXED STRINGS, not computed: this fake must never grow a
// second implementation of the warranty rule. It matches on the digits of the
// stored key so the demo behaves like the real endpoint for a raw-typed number —
// a DEMO CONVENIENCE, not a normaliser: it never produces a key, only compares.

import 'warranty_port.dart';

String _digits(String raw) => raw.replaceAll(RegExp('[^0-9]'), '');

const String demoWarrantySdt = '+84903176968';

/// Two orders with warranty — enough to render every status branch on one screen.
final List<WarrantyOrder> demoWarrantyOrders = <WarrantyOrder>[
  const WarrantyOrder(
    id: 'ord-2026-014',
    status: 'nghiem_thu',
    chotAt: '2026-02-10T00:00:00.000Z',
    lineItems: <WarrantyLine>[
      WarrantyLine(
        id: 'line-pin',
        name: 'Tấm pin JA Solar 580W',
        qty: 18,
        unit: 'tấm',
        warrantyMonths: 144,
        warrantyStartAt: '2026-02-10T00:00:00.000Z',
        warrantyEndAt: '2038-02-10T00:00:00.000Z',
        remainingDays: 4224,
        remainingMonths: 138,
        warrantyStatus: 'con_han',
      ),
      // Added in a later version of the same order — its own start date, which is
      // exactly why warranty is pinned per LINE and not per order (FR-36).
      WarrantyLine(
        id: 'line-inverter',
        name: 'Inverter Sungrow 10kW',
        qty: 1,
        unit: 'bộ',
        warrantyMonths: 60,
        warrantyStartAt: '2026-05-04T00:00:00.000Z',
        warrantyEndAt: '2031-05-04T00:00:00.000Z',
        remainingDays: 1751,
        remainingMonths: 57,
        warrantyStatus: 'con_han',
      ),
    ],
  ),
  const WarrantyOrder(
    id: 'ord-2023-101',
    status: 'nghiem_thu',
    chotAt: '2023-08-01T00:00:00.000Z',
    lineItems: <WarrantyLine>[
      WarrantyLine(
        id: 'line-ac',
        name: 'Tủ điện AC 3 pha',
        qty: 1,
        unit: 'tủ',
        warrantyMonths: 36,
        warrantyStartAt: '2023-08-01T00:00:00.000Z',
        warrantyEndAt: '2026-08-01T00:00:00.000Z',
        remainingDays: 14,
        remainingMonths: 0,
        warrantyStatus: 'sap_het',
      ),
      WarrantyLine(
        id: 'line-pin-cu',
        name: 'Ắc quy lưu trữ 5kWh',
        qty: 2,
        unit: 'bình',
        warrantyMonths: 24,
        warrantyStartAt: '2023-08-01T00:00:00.000Z',
        warrantyEndAt: '2025-08-01T00:00:00.000Z',
        remainingDays: -351,
        remainingMonths: 0,
        warrantyStatus: 'het_han',
      ),
    ],
  ),
];

class FakeWarrantyPort implements WarrantyPort {
  const FakeWarrantyPort();

  @override
  Future<WarrantyLookup> lookup(String sdt) async {
    final String needle = _digits(sdt);
    if (needle.isEmpty) {
      throw const WarrantyPortException('Số điện thoại không hợp lệ.');
    }
    if (!_digits(demoWarrantySdt).endsWith(needle)) {
      // "No such customer" is a 200 with an empty answer, never a throw.
      return const WarrantyLookup(
        found: false,
        sdt: demoWarrantySdt,
        orders: <WarrantyOrder>[],
      );
    }
    return WarrantyLookup(
      found: true,
      sdt: demoWarrantySdt,
      customer: const WarrantyCustomer(
        sdt: demoWarrantySdt,
        name: 'Nguyễn Văn A',
        custType: 'CA_NHAN',
      ),
      orders: demoWarrantyOrders,
    );
  }
}
