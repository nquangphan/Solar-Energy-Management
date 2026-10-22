// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'replace_payment_schedule_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReplacePaymentScheduleRequestDto _$ReplacePaymentScheduleRequestDtoFromJson(
  Map<String, dynamic> json,
) => ReplacePaymentScheduleRequestDto(
  installments: (json['installments'] as List<dynamic>)
      .map((e) => InstallmentInputDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$ReplacePaymentScheduleRequestDtoToJson(
  ReplacePaymentScheduleRequestDto instance,
) => <String, dynamic>{'installments': instance.installments};
