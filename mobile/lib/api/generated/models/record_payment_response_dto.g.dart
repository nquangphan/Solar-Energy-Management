// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'record_payment_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RecordPaymentResponseDto _$RecordPaymentResponseDtoFromJson(
  Map<String, dynamic> json,
) => RecordPaymentResponseDto(
  payment: PaymentResponseDto.fromJson(json['payment'] as Map<String, dynamic>),
  schedule: PaymentScheduleResponseDto.fromJson(
    json['schedule'] as Map<String, dynamic>,
  ),
  orderStatus: json['orderStatus'] as String,
  autoTransition: json['autoTransition'] == null
      ? null
      : AutoTransitionResultDto.fromJson(
          json['autoTransition'] as Map<String, dynamic>,
        ),
);

Map<String, dynamic> _$RecordPaymentResponseDtoToJson(
  RecordPaymentResponseDto instance,
) => <String, dynamic>{
  'payment': instance.payment,
  'schedule': instance.schedule,
  'orderStatus': instance.orderStatus,
  'autoTransition': instance.autoTransition,
};
