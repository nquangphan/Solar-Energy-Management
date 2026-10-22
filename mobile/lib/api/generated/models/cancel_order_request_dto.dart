// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'cancel_order_request_dto.g.dart';

@JsonSerializable()
class CancelOrderRequestDto {
  const CancelOrderRequestDto({
    required this.reason,
  });
  
  factory CancelOrderRequestDto.fromJson(Map<String, Object?> json) => _$CancelOrderRequestDtoFromJson(json);
  
  /// Lý do huỷ đơn — BẮT BUỘC, tối thiểu 3 ký tự sau khi trim (service enforce).
  final String reason;

  Map<String, Object?> toJson() => _$CancelOrderRequestDtoToJson(this);
}
