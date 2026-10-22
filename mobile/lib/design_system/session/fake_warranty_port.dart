// hand-authored — TEST/DEMO-ONLY fake port (Story 5.9, mirror web
// web/src/design-system/session/fake-warranty-port.ts).
//
// NOT a real backend: an in-memory answer so the Tra cứu bảo hành screen is
// demoable/testable WITHOUT an app-runtime or network. It enforces NO business
// rule — phone normalisation, permission scoping and every warranty date live on
// the server (AD-4/AD-9).
//
// The dates here are FIXED UTC instants (`DateTime.utc`), not computed: this fake must never grow a
// second implementation of the warranty rule. It matches on the digits of the
// stored key so the demo behaves like the real endpoint for a raw-typed number —
// a DEMO CONVENIENCE, not a normaliser: it never produces a key, only compares.

import 'warranty_port.dart';

String _digits(String raw) => raw.replaceAll(RegExp('[^0-9]'), '');

const String demoWarrantySdt = '+84903176968';

/// Two orders with warranty — enough to render every status branch on one screen.
final List<WarrantyOrder> demoWarrantyOrders = <WarrantyOrder>[
  WarrantyOrder(
    id: 'ord-2026-014',
    status: 'nghiem_thu',
    confirmedAt: DateTime.utc(2026, 2, 10),
    lineItems: <WarrantyLine>[
      WarrantyLine(
        id: 'line-pin',
        name: 'Tấm pin JA Solar 580W',
        qty: 18,
        unit: 'tấm',
        warrantyMonths: 144,
        warrantyStartAt: DateTime.utc(2026, 2, 10),
        warrantyEndAt: DateTime.utc(2038, 2, 10),
        remainingDays: 4224,
        remainingMonths: 138,
        warrantyStatus: WarrantyLineItemDtoWarrantyStatus.conHan,
      ),
      // Added in a later version of the same order — its own start date, which is
      // exactly why warranty is pinned per LINE and not per order (FR-36).
      WarrantyLine(
        id: 'line-inverter',
        name: 'Inverter Sungrow 10kW',
        qty: 1,
        unit: 'bộ',
        warrantyMonths: 60,
        warrantyStartAt: DateTime.utc(2026, 5, 4),
        warrantyEndAt: DateTime.utc(2031, 5, 4),
        remainingDays: 1751,
        remainingMonths: 57,
        warrantyStatus: WarrantyLineItemDtoWarrantyStatus.conHan,
      ),
    ],
  ),
  WarrantyOrder(
    id: 'ord-2023-101',
    status: 'nghiem_thu',
    confirmedAt: DateTime.utc(2023, 8, 1),
    lineItems: <WarrantyLine>[
      WarrantyLine(
        id: 'line-ac',
        name: 'Tủ điện AC 3 pha',
        qty: 1,
        unit: 'tủ',
        warrantyMonths: 36,
        warrantyStartAt: DateTime.utc(2023, 8, 1),
        warrantyEndAt: DateTime.utc(2026, 8, 1),
        remainingDays: 14,
        remainingMonths: 0,
        warrantyStatus: WarrantyLineItemDtoWarrantyStatus.sapHet,
      ),
      WarrantyLine(
        id: 'line-pin-cu',
        name: 'Ắc quy lưu trữ 5kWh',
        qty: 2,
        unit: 'bình',
        warrantyMonths: 24,
        warrantyStartAt: DateTime.utc(2023, 8, 1),
        warrantyEndAt: DateTime.utc(2025, 8, 1),
        remainingDays: -351,
        remainingMonths: 0,
        warrantyStatus: WarrantyLineItemDtoWarrantyStatus.hetHan,
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
        phone: demoWarrantySdt,
        customer: null,
        orders: <WarrantyOrder>[],
      );
    }
    return WarrantyLookup(
      found: true,
      phone: demoWarrantySdt,
      customer: const WarrantyCustomer(
        phone: demoWarrantySdt,
        name: 'Nguyễn Văn A',
        custType: 'CA_NHAN',
      ),
      orders: demoWarrantyOrders,
    );
  }
}
