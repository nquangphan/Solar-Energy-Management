// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'cancel_order_response_dto_status.dart';

part 'cancel_order_response_dto.g.dart';

@JsonSerializable()
class CancelOrderResponseDto {
  const CancelOrderResponseDto({
    required this.status,
    required this.occurredAt,
  });
  
  factory CancelOrderResponseDto.fromJson(Map<String, Object?> json) => _$CancelOrderResponseDtoFromJson(json);
  
  /// Trạng thái đơn SAU khi huỷ — luôn 'huy'.
  final CancelOrderResponseDtoStatus status;

  /// Thời điểm huỷ (ISO-8601 UTC). CÙNG một giá trị với cột `cancelledAt` và với `occurredAt` của hàng audit.
  final String occurredAt;

  Map<String, Object?> toJson() => _$CancelOrderResponseDtoToJson(this);
}
