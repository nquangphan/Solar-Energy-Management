// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'order_discount_dto.g.dart';

@JsonSerializable()
class OrderDiscountDto {
  const OrderDiscountDto({
    required this.amount,
    required this.status,
    required this.requestedAt,
    this.requestNote,
    this.resolveNote,
    this.resolvedAt,
  });
  
  factory OrderDiscountDto.fromJson(Map<String, Object?> json) => _$OrderDiscountDtoFromJson(json);
  
  /// Mức chiết khấu đề xuất — integer đồng.
  final num amount;

  /// Trạng thái hồ sơ duyệt: 'cho_duyet' | 'dong_y' | 'tu_choi' (phân biệt với Order.status 'choduyet').
  final String status;
  final String? requestNote;

  /// Lý do duyệt / từ chối — null khi chưa resolve.
  final String? resolveNote;

  /// Thời điểm gửi duyệt.
  final DateTime requestedAt;
  final DateTime? resolvedAt;

  Map<String, Object?> toJson() => _$OrderDiscountDtoToJson(this);
}
