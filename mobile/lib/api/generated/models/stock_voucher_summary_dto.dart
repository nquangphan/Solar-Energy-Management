// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'stock_voucher_creator_dto.dart';
import 'stock_voucher_summary_dto_type.dart';

part 'stock_voucher_summary_dto.g.dart';

@JsonSerializable()
class StockVoucherSummaryDto {
  const StockVoucherSummaryDto({
    required this.id,
    required this.code,
    required this.type,
    required this.createdAt,
    required this.createdBy,
    required this.lineCount,
    required this.totalQty,
    this.orderId,
    this.returnOfVoucherId,
  });
  
  factory StockVoucherSummaryDto.fromJson(Map<String, Object?> json) => _$StockVoucherSummaryDtoFromJson(json);
  
  final String id;

  /// Mã phiếu hiển thị.
  final String code;
  final StockVoucherSummaryDtoType type;

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

  Map<String, Object?> toJson() => _$StockVoucherSummaryDtoToJson(this);
}
