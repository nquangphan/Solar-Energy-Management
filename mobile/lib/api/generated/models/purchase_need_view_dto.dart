// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'purchase_need_view_dto.g.dart';

@JsonSerializable()
class PurchaseNeedViewDto {
  const PurchaseNeedViewDto({
    required this.productId,
    required this.name,
    required this.unit,
    required this.toPurchase,
  });
  
  factory PurchaseNeedViewDto.fromJson(Map<String, Object?> json) => _$PurchaseNeedViewDtoFromJson(json);
  
  final String productId;
  final String name;
  final String unit;
  final num toPurchase;

  Map<String, Object?> toJson() => _$PurchaseNeedViewDtoToJson(this);
}
