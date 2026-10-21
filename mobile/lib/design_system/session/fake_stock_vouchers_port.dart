// hand-authored — TEST/DEMO-ONLY fake port (Story 6.3, mirror web
// web/src/design-system/session/fake-stock-vouchers-port.ts).
//
// NOT a real backend: canned vouchers so the Phiếu kho screen is demoable and
// guardable without an app-runtime. Codes, counts and costs below are typed as
// the backend would return them — this fake owns no copy of the cost or stock
// rules. Its one refusal (409 INSUFFICIENT_STOCK) is a fixed branch on a fixed
// product, not a stock comparison.

import 'fake_inventory_port.dart';
import 'inventory_port.dart';
import 'stock_vouchers_port.dart';

const StockVoucherCreator _kKho = StockVoucherCreator(
  id: 'acc-kho-binh',
  displayName: 'Kho/Giao hàng (Bình)',
);

/// Stock-in with costs, stock-out WITHOUT costs (caller lacks `costs.view`), and the LONGEST product name.
const List<StockVoucherDetail> kDemoStockVouchers = <StockVoucherDetail>[
  StockVoucherDetail(
    id: 'pk-n-0119',
    ma: 'PK-N-0119',
    type: 'nhap',
    createdAt: '2026-07-06T01:05:00.000Z',
    nguoiTao: _kKho,
    soDong: 2,
    tongSoLuong: 50,
    note: 'Nhập từ nhà cung cấp',
    lines: <StockVoucherLine>[
      StockVoucherLine(
        productId: 'prod-day-dc-4',
        ten: 'Dây DC 4mm² (cuộn 100m)',
        sku: 'DC-4-100',
        donVi: 'cuộn',
        qty: 10,
        unitCost: 1480000,
      ),
      StockVoucherLine(
        productId: 'prod-pin-ae-630',
        ten: 'Tấm pin AE 630W',
        sku: 'PIN-AE-630',
        donVi: 'tấm',
        qty: 40,
        unitCost: 2110000,
      ),
    ],
  ),
  StockVoucherDetail(
    id: 'pk-x-0096',
    ma: 'PK-X-0096',
    type: 'xuat',
    createdAt: '2026-07-05T23:30:00.000Z',
    nguoiTao: _kKho,
    soDong: 2,
    tongSoLuong: 15,
    note: 'Hàng mẫu cho khách',
    lines: <StockVoucherLine>[
      StockVoucherLine(
        productId: 'prod-inverter-8k',
        ten: 'Inverter Solplanet ASW8000-S',
        sku: 'INV-ASW8000',
        donVi: 'bộ',
        qty: 1,
      ),
      StockVoucherLine(
        productId: 'prod-pin-ae-630',
        ten: 'Tấm pin AE 630W',
        sku: 'PIN-AE-630',
        donVi: 'tấm',
        qty: 14,
      ),
    ],
  ),
  // Order-bound stock-out — `nguoiTao` is the person who CONFIRMED it.
  // `canReturn` is a fixture value, as the backend would return it.
  StockVoucherDetail(
    id: 'pk-x-0095',
    ma: 'PK-X-0095',
    type: 'xuat',
    orderId: 'ord-demo-4',
    createdAt: '2026-07-04T02:30:00.000Z',
    nguoiTao: _kKho,
    soDong: 1,
    tongSoLuong: 1,
    note: null,
    canReturn: true,
    lines: <StockVoucherLine>[
      StockVoucherLine(
        productId: 'prod-inverter-hybrid-10k',
        ten: 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha',
        sku: 'INV-ASW10K-H',
        donVi: 'bộ',
        qty: 1,
      ),
    ],
  ),
  StockVoucherDetail(
    id: 'pk-n-0118',
    ma: 'PK-N-0118',
    type: 'nhap',
    createdAt: '2026-07-02T02:00:00.000Z',
    nguoiTao: _kKho,
    soDong: 1,
    tongSoLuong: 5,
    note: 'Tồn đầu kỳ',
    lines: <StockVoucherLine>[
      StockVoucherLine(
        productId: 'prod-inverter-hybrid-10k',
        ten: 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha',
        sku: 'INV-ASW10K-H',
        donVi: 'bộ',
        qty: 5,
        unitCost: 18500000,
      ),
    ],
  ),
];

/// The fake refuses any stock-out of this product (it has nothing on hand in the demo stock list).
const String kFakeOutOfStockProductId = 'prod-battery-10kwh';

const StockVoucherPortException kFakeInsufficientStockError =
    StockVoucherPortException(
  'Không đủ tồn — không thể xuất quá số tồn hiện có.',
  fieldErrors: <StockVoucherFieldError>[
    StockVoucherFieldError(
      field: 'lines.0.qty',
      code: 'INSUFFICIENT_STOCK',
      message: 'Còn 0 bình, không xuất được 1.',
    ),
  ],
);

StockVoucherSummary _tomTat(StockVoucherDetail d) => StockVoucherSummary(
      id: d.id,
      ma: d.ma,
      type: d.type,
      orderId: d.orderId,
      createdAt: d.createdAt,
      nguoiTao: d.nguoiTao,
      soDong: d.soDong,
      tongSoLuong: d.tongSoLuong,
      returnOfVoucherId: d.returnOfVoucherId,
    );

class FakeStockVouchersPort implements StockVouchersPort {
  FakeStockVouchersPort([List<StockVoucherDetail> data = kDemoStockVouchers])
      : _data = List<StockVoucherDetail>.of(data);

  final List<StockVoucherDetail> _data;

  @override
  Future<StockVoucherList> listVouchers({String? type, bool? isReturn}) async {
    return StockVoucherList(
      items: <StockVoucherSummary>[
        for (final StockVoucherDetail d in _data)
          if ((type == null || d.type == type) &&
              (isReturn == null || (d.returnOfVoucherId != null) == isReturn))
            _tomTat(d),
      ],
    );
  }

  @override
  Future<StockVoucherDetail> getVoucher(String id) async {
    for (final StockVoucherDetail d in _data) {
      if (d.id == id) return d;
    }
    throw const StockVoucherPortException('Không tìm thấy phiếu kho.');
  }

  @override
  Future<StockVoucherDetail> createVoucher(
      CreateStockVoucherInput input) async {
    if (input.type == 'xuat' &&
        input.lines.any(
          (CreateStockVoucherLineInput l) =>
              l.productId == kFakeOutOfStockProductId,
        )) {
      throw kFakeInsufficientStockError;
    }
    // A canned answer shaped like the backend's — the demo screen needs a row to select.
    final StockVoucherDetail moi = StockVoucherDetail(
      id: 'pk-demo-${_data.length + 1}',
      ma: input.type == 'nhap' ? 'PK-N-0120' : 'PK-X-0097',
      type: input.type,
      createdAt: '2026-10-21T03:15:00.000Z',
      nguoiTao: _kKho,
      soDong: input.lines.length,
      tongSoLuong: input.lines.fold<int>(
        0,
        (int tong, CreateStockVoucherLineInput l) => tong + l.qty,
      ),
      note: input.note,
      lines: <StockVoucherLine>[
        for (final CreateStockVoucherLineInput l in input.lines) _dong(l),
      ],
    );
    _data.insert(0, moi);
    return moi;
  }

  /// A canned answer shaped like the backend's — no stock or cost rule here.
  @override
  Future<StockVoucherDetail> createReturnVoucher(
    String originVoucherId, {
    String? note,
    required List<CreateReturnVoucherLineInput> lines,
  }) async {
    final StockVoucherDetail origin = await getVoucher(originVoucherId);
    final StockVoucherDetail created = StockVoucherDetail(
      id: 'pk-nt-demo-${_data.length + 1}',
      ma: 'PK-NT-0005',
      type: 'nhap',
      createdAt: '2026-10-21T03:15:00.000Z',
      nguoiTao: _kKho,
      soDong: lines.length,
      tongSoLuong: lines.fold<int>(
        0,
        (int sum, CreateReturnVoucherLineInput l) => sum + l.qty,
      ),
      returnOfVoucherId: origin.id,
      returnOf: StockVoucherReturnOf(
        id: origin.id,
        ma: origin.ma,
        orderId: origin.orderId ?? '',
      ),
      note: note,
      lines: <StockVoucherLine>[
        for (final CreateReturnVoucherLineInput l in lines)
          _dong(
              CreateStockVoucherLineInput(productId: l.productId, qty: l.qty)),
      ],
    );
    // The origin now has its return voucher and can no longer be returned.
    final int at =
        _data.indexWhere((StockVoucherDetail d) => d.id == origin.id);
    _data[at] = StockVoucherDetail(
      id: origin.id,
      ma: origin.ma,
      type: origin.type,
      orderId: origin.orderId,
      createdAt: origin.createdAt,
      nguoiTao: origin.nguoiTao,
      soDong: origin.soDong,
      tongSoLuong: origin.tongSoLuong,
      returnOfVoucherId: origin.returnOfVoucherId,
      note: origin.note,
      lines: origin.lines,
      returnOf: origin.returnOf,
      returnVoucher: StockVoucherReturnRef(id: created.id, ma: created.ma),
      canReturn: false,
    );
    _data.insert(0, created);
    return created;
  }

  StockVoucherLine _dong(CreateStockVoucherLineInput l) {
    StockItemView? sp;
    for (final StockItemView i in kDemoStockList.items) {
      if (i.productId == l.productId) sp = i;
    }
    return StockVoucherLine(
      productId: l.productId,
      ten: sp?.ten ?? l.productId,
      sku: sp?.sku ?? '',
      donVi: sp?.donVi ?? '',
      qty: l.qty,
      unitCost: l.unitCost,
    );
  }
}
