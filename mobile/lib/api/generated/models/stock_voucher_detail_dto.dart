// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'stock_voucher_creator_dto.dart';
import 'stock_voucher_detail_dto_type.dart';
import 'stock_voucher_line_response_dto.dart';
import 'stock_voucher_return_of_dto.dart';
import 'stock_voucher_return_ref_dto.dart';

part 'stock_voucher_detail_dto.g.dart';

@JsonSerializable()
class StockVoucherDetailDto {
  const StockVoucherDetailDto({
    required this.id,
    required this.code,
    required this.type,
    required this.createdAt,
    required this.createdBy,
    required this.lineCount,
    required this.totalQty,
    required this.note,
    required this.lines,
    required this.canReturn,
    this.orderId,
    this.returnOfVoucherId,
    this.returnOf,
    this.returnVoucher,
  });
  
  factory StockVoucherDetailDto.fromJson(Map<String, Object?> json) => _$StockVoucherDetailDtoFromJson(json);
  
  final String id;

  /// Mã phiếu hiển thị.
  final String code;
  final StockVoucherDetailDtoType type;

  /// Đơn mà phiếu xuất này gắn vào (một Đơn — một phiếu xuất). CHỈ có mặt ở phiếu xuất gắn đơn; phiếu tự do ⇒ field vắng mặt hẳn (không phải null).
  final String? orderId;

  /// Phiếu xuất gốc mà phiếu nhập trả này nhận hàng về. CHỈ có mặt ở phiếu nhập trả; phiếu khác ⇒ field vắng mặt hẳn.
  final String? returnOfVoucherId;

  /// Thời điểm lưu phiếu (ISO-8601 UTC).
  final DateTime createdAt;
  final StockVoucherCreatorDto createdBy;

  /// Số dòng sản phẩm.
  final num lineCount;

  /// Tổng số lượng các dòng (luôn dương).
  final num totalQty;
  final String? note;
  final List<StockVoucherLineResponseDto> lines;

  /// CHỈ có mặt ở phiếu nhập trả: phiếu xuất gốc + đơn đã huỷ.
  final StockVoucherReturnOfDto? returnOf;

  /// CHỈ có mặt ở phiếu xuất gắn đơn đã có phiếu nhập trả.
  final StockVoucherReturnRefDto? returnVoucher;

  /// true ⇔ phiếu xuất gắn đơn, đơn đã huỷ, chưa có phiếu nhập trả — backend tính, client không tự suy.
  final bool canReturn;

  Map<String, Object?> toJson() => _$StockVoucherDetailDtoToJson(this);
}
