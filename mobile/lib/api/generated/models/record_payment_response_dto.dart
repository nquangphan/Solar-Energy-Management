// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'auto_transition_result_dto.dart';
import 'payment_response_dto.dart';
import 'payment_schedule_response_dto.dart';

part 'record_payment_response_dto.g.dart';

@JsonSerializable()
class RecordPaymentResponseDto {
  const RecordPaymentResponseDto({
    required this.payment,
    required this.schedule,
    required this.orderStatus,
    required this.autoTransition,
  });
  
  factory RecordPaymentResponseDto.fromJson(Map<String, Object?> json) => _$RecordPaymentResponseDtoFromJson(json);
  
  final PaymentResponseDto payment;

  /// Lịch thanh toán HIỆN TẠI sau lần ghi.
  final PaymentScheduleResponseDto schedule;

  /// Trạng thái đơn hiện tại.
  final String orderStatus;

  /// null khi lần ghi này không làm đủ mốc nào, và luôn null khi gửi lại cùng khoá. Khi một lần ghi làm đủ cả cọc lẫn tất toán (đợt cọc trả sau cùng), đây là lần chuyển đã đổi trạng thái đơn, nếu không có thì là lần thử sau cùng.
  final AutoTransitionResultDto? autoTransition;

  Map<String, Object?> toJson() => _$RecordPaymentResponseDtoToJson(this);
}
