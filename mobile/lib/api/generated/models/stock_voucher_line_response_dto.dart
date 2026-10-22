// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'stock_voucher_line_response_dto.g.dart';

@JsonSerializable()
class StockVoucherLineResponseDto {
  const StockVoucherLineResponseDto({
    required this.productId,
    required this.name,
    required this.sku,
    required this.unit,
    required this.qty,
    this.unitCost,
  });
  
  factory StockVoucherLineResponseDto.fromJson(Map<String, Object?> json) => _$StockVoucherLineResponseDtoFromJson(json);
  
  final String productId;

  /// Tên sản phẩm.
  final String name;
  final String sku;

  /// Đơn vị tính.
  final String unit;

  /// Số lượng (luôn dương; chiều theo `type`).
  final num qty;

  /// Giá vốn / đv — số nguyên ĐỒNG. CHỈ có mặt khi caller mang quyền costs.view; thiếu quyền ⇒ field vắng mặt hẳn (không phải 0, không phải null).
  final num? unitCost;

  Map<String, Object?> toJson() => _$StockVoucherLineResponseDtoToJson(this);
}
