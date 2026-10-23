// The two ports of StockVouchersCubit in one (Story 11.4): FakeStockVouchersPort
// and FakeInventoryPort underneath, every call of either logged in ONE order (see
// RecordingPortCalls), so a test can tell a product search from a list read.
import 'package:pns_mobile/design_system/session/fake_inventory_port.dart';
import 'package:pns_mobile/design_system/session/fake_stock_vouchers_port.dart';
import 'package:pns_mobile/design_system/session/inventory_port.dart';
import 'package:pns_mobile/design_system/session/stock_vouchers_port.dart';

import '../recording_port_calls.dart';

class RecordingStockVouchersPort extends FakeStockVouchersPort with RecordingPortCalls implements InventoryPort {
  RecordingStockVouchersPort([super.data]);

  @override
  Future<StockVoucherList> listVouchers({String? type, bool? isReturn}) => record(
        'listVouchers',
        [type, isReturn],
        () => super.listVouchers(type: type, isReturn: isReturn),
      );

  @override
  Future<StockVoucherDetail> getVoucher(String id) => record('getVoucher', [id], () => super.getVoucher(id));

  @override
  Future<StockVoucherDetail> createVoucher(CreateStockVoucherInput input) =>
      record('createVoucher', [input], () => super.createVoucher(input));

  @override
  Future<StockVoucherDetail> createReturnVoucher(
    String originVoucherId, {
    String? note,
    required List<CreateReturnVoucherLineInput> lines,
  }) =>
      record(
        'createReturnVoucher',
        [originVoucherId, note, lines],
        () => super.createReturnVoucher(originVoucherId, note: note, lines: lines),
      );

  @override
  Future<StockList> listStock({String? q}) =>
      record('listStock', [q], () => const FakeInventoryPort().listStock(q: q));
}
