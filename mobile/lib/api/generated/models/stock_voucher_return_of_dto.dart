// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'stock_voucher_return_of_dto.g.dart';

@JsonSerializable()
class StockVoucherReturnOfDto {
  const StockVoucherReturnOfDto({
    required this.id,
    required this.code,
    required this.orderId,
  });
  
  factory StockVoucherReturnOfDto.fromJson(Map<String, Object?> json) => _$StockVoucherReturnOfDtoFromJson(json);
  
  final String id;

  /// Mã phiếu xuất gốc.
  final String code;

  /// Đơn (đã huỷ) của phiếu xuất gốc.
  final String orderId;

  Map<String, Object?> toJson() => _$StockVoucherReturnOfDtoToJson(this);
}
