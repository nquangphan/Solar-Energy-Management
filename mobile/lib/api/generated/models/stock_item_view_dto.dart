// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'stock_item_view_dto_stock_status.dart';

part 'stock_item_view_dto.g.dart';

@JsonSerializable()
class StockItemViewDto {
  const StockItemViewDto({
    required this.productId,
    required this.name,
    required this.sku,
    required this.unit,
    required this.onHand,
    required this.reserved,
    required this.available,
    required this.toPurchase,
    required this.stockStatus,
  });
  
  factory StockItemViewDto.fromJson(Map<String, Object?> json) => _$StockItemViewDtoFromJson(json);
  
  final String productId;

  /// Tên sản phẩm.
  final String name;
  final String sku;

  /// Đơn vị tính.
  final String unit;

  /// Tồn thật trong kho.
  final num onHand;

  /// Đã hứa cho đơn đã chốt — tổng ledger giữ chỗ.
  final num reserved;

  /// `onHand − reserved` — CÓ THỂ ÂM.
  final num available;

  /// Phần thiếu phải nhập (0 khi khả dụng không âm).
  final num toPurchase;

  /// du = còn khả dụng · het = khả dụng 0 · am = hứa vượt hàng thật.
  final StockItemViewDtoStockStatus stockStatus;

  Map<String, Object?> toJson() => _$StockItemViewDtoToJson(this);
}
