// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'order_lifecycle_step_dto.dart';
import 'order_next_step_dto.dart';

part 'order_lifecycle_response_dto.g.dart';

@JsonSerializable()
class OrderLifecycleResponseDto {
  const OrderLifecycleResponseDto({
    required this.steps,
    required this.nextSteps,
    required this.canCancel,
  });
  
  factory OrderLifecycleResponseDto.fromJson(Map<String, Object?> json) => _$OrderLifecycleResponseDtoFromJson(json);
  
  final List<OrderLifecycleStepDto> steps;

  /// Bước kế tiếp NGƯỜI GỌI bấm được. MẢNG RỖNG ⇒ nút "Chuyển trạng thái" ẩn hẳn, không vẽ xám (UX-DR-22).
  final List<OrderNextStepDto> nextSteps;

  /// Người gọi này huỷ được đơn này không (Story 5.7) — tính từ bảng transition × trạng thái hiện tại × quyền THẬT. `false` ⇒ ẩn HẲN nút "Huỷ đơn", không vẽ xám (UX-DR-22). Client KHÔNG suy được cờ này từ `nextSteps`: `huy` không thuộc lane thủ công nên không bao giờ có mặt ở đó.
  final bool canCancel;

  Map<String, Object?> toJson() => _$OrderLifecycleResponseDtoToJson(this);
}
