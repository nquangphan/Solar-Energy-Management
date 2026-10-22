// hand-authored — the real StockVouchersPort over the generated client (Story
// 10.8, mirror web/src/api/http-stock-vouchers-port.ts).
//
// A stock-out line must carry NO `unitCost` key (the server snapshots the cost),
// so the create body goes through sparse_bodies.dart. The screen pins each
// backend field error to its line by the `lines.{i}.…` path, so [_call] keeps
// every field error, in order.
import '../design_system/session/stock_vouchers_port.dart';
import 'api_error.dart';
import 'generated/models/create_return_voucher_request_dto.dart';
import 'generated/models/type.dart';
import 'generated/pns_api_client.dart';
import 'sparse_bodies.dart';
import 'transport.dart';

class HttpStockVouchersPort implements StockVouchersPort {
  HttpStockVouchersPort(this._client, this._transport);

  final PnsApiClient _client;
  final Transport _transport;

  Future<T> _call<T>(Future<T> Function() request) async {
    try {
      return await _transport.call(request);
    } on ApiError catch (e) {
      throw StockVoucherPortException(
        e.message,
        fieldErrors: [
          for (final f in e.fieldErrors ?? const [])
            StockVoucherFieldError(field: f.field, code: f.code, message: f.message),
        ],
      );
    }
  }

  @override
  Future<StockVoucherList> listVouchers({String? type, bool? isReturn}) => _call(
    () => _client.inventory.stockVouchersControllerList(
      type: type == null ? null : Type.fromJson(type),
      isReturn: isReturn,
    ),
  );

  @override
  Future<StockVoucherDetail> getVoucher(String id) =>
      _call(() => _client.inventory.stockVouchersControllerFindOne(id: Uri.encodeComponent(id)));

  @override
  Future<StockVoucherDetail> createVoucher(CreateStockVoucherInput input) =>
      _call(() => _client.inventory.stockVouchersControllerCreate(body: stockVoucherBody(input)));

  @override
  Future<StockVoucherDetail> createReturnVoucher(
    String originVoucherId, {
    String? note,
    required List<CreateReturnVoucherLineInput> lines,
  }) => _call(
    () => _client.inventory.stockVouchersControllerCreateReturn(
      id: Uri.encodeComponent(originVoucherId),
      body: CreateReturnVoucherRequestDto(note: note, lines: lines),
    ),
  );
}
