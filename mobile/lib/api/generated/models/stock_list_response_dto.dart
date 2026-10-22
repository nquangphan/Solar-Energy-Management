// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'purchase_need_view_dto.dart';
import 'stock_item_view_dto.dart';

part 'stock_list_response_dto.g.dart';

@JsonSerializable()
class StockListResponseDto {
  const StockListResponseDto({
    required this.items,
    required this.purchaseList,
  });
  
  factory StockListResponseDto.fromJson(Map<String, Object?> json) => _$StockListResponseDtoFromJson(json);
  
  /// Sắp theo tên sản phẩm.
  final List<StockItemViewDto> items;

  /// Các sản phẩm khả dụng âm của CÙNG tập `items`, sắp `toPurchase` giảm dần rồi theo tên.
  final List<PurchaseNeedViewDto> purchaseList;

  Map<String, Object?> toJson() => _$StockListResponseDtoToJson(this);
}
