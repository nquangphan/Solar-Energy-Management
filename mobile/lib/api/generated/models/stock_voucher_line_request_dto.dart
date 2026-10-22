// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'stock_voucher_line_request_dto.g.dart';

@JsonSerializable()
class StockVoucherLineRequestDto {
  const StockVoucherLineRequestDto({
    required this.productId,
    required this.qty,
    this.unitCost,
  });
  
  factory StockVoucherLineRequestDto.fromJson(Map<String, Object?> json) => _$StockVoucherLineRequestDtoFromJson(json);
  
  /// Sản phẩm (UUID).
  final String productId;

  /// Số lượng — nguyên dương, tối đa 1000000. Chiều cộng/trừ do `type` của phiếu quyết.
  final num qty;

  /// Giá vốn / đv — số nguyên ĐỒNG. BẮT BUỘC khi phiếu nhập; phiếu xuất KHÔNG được gửi (server tự lấy giá vốn hiện hành).
  final num? unitCost;

  Map<String, Object?> toJson() => _$StockVoucherLineRequestDtoToJson(this);
}
