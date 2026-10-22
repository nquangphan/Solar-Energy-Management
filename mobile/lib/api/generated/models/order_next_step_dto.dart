// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'order_next_step_dto_to.dart';

part 'order_next_step_dto.g.dart';

@JsonSerializable()
class OrderNextStepDto {
  const OrderNextStepDto({
    required this.event,
    required this.to,
    required this.requires,
  });
  
  factory OrderNextStepDto.fromJson(Map<String, Object?> json) => _$OrderNextStepDtoFromJson(json);
  
  /// Sự kiện phải gửi lên `POST /orders/{id}/transition` để đi bước này.
  final String event;

  /// Đơn sẽ tới trạng thái nào — do bảng transition quyết, không do client.
  final OrderNextStepDtoTo to;

  /// Quyền mà bước này đòi (thông tin hiển thị/chẩn đoán).
  final String requires;

  Map<String, Object?> toJson() => _$OrderNextStepDtoToJson(this);
}
