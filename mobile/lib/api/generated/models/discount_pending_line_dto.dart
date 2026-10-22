// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'discount_pending_line_dto.g.dart';

@JsonSerializable()
class DiscountPendingLineDto {
  const DiscountPendingLineDto({
    required this.name,
    required this.qty,
    required this.unitPrice,
    this.estimatedMarginPct,
  });
  
  factory DiscountPendingLineDto.fromJson(Map<String, Object?> json) => _$DiscountPendingLineDtoFromJson(json);
  
  /// Tên dòng báo giá.
  final String name;

  /// Số lượng.
  final num qty;

  /// Đơn giá HIỆU LỰC hiện tại — integer đồng.
  final num unitPrice;

  /// Biên ƯỚC TÍNH (%) theo Product.costPrice HIỆN HÀNH — integer half-up; null khi dòng tự do, unitPrice = 0, hoặc actor thiếu costs.view (FR-37).
  final num? estimatedMarginPct;

  Map<String, Object?> toJson() => _$DiscountPendingLineDtoToJson(this);
}
