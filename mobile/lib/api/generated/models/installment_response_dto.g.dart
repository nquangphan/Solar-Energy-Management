// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'installment_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

InstallmentResponseDto _$InstallmentResponseDtoFromJson(
  Map<String, dynamic> json,
) => InstallmentResponseDto(
  id: json['id'] as String,
  seq: json['seq'] as num,
  percent: json['percent'] as num?,
  amount: json['amount'] as num,
  conditionNote: json['conditionNote'] as String,
  milestone: json['milestone'] == null
      ? null
      : InstallmentResponseDtoMilestone.fromJson(json['milestone'] as String),
  paidAmount: json['paidAmount'] as num,
  remainingAmount: json['remainingAmount'] as num,
  status: InstallmentResponseDtoStatus.fromJson(json['status'] as String),
  payments: (json['payments'] as List<dynamic>)
      .map((e) => PaymentResponseDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$InstallmentResponseDtoToJson(
  InstallmentResponseDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'seq': instance.seq,
  'percent': instance.percent,
  'amount': instance.amount,
  'conditionNote': instance.conditionNote,
  'milestone': _$InstallmentResponseDtoMilestoneEnumMap[instance.milestone],
  'paidAmount': instance.paidAmount,
  'remainingAmount': instance.remainingAmount,
  'status': _$InstallmentResponseDtoStatusEnumMap[instance.status]!,
  'payments': instance.payments,
};

const _$InstallmentResponseDtoMilestoneEnumMap = {
  InstallmentResponseDtoMilestone.coc: 'coc',
  InstallmentResponseDtoMilestone.tatToan: 'tat_toan',
  InstallmentResponseDtoMilestone.$unknown: r'$unknown',
};

const _$InstallmentResponseDtoStatusEnumMap = {
  InstallmentResponseDtoStatus.unpaid: 'unpaid',
  InstallmentResponseDtoStatus.partial: 'partial',
  InstallmentResponseDtoStatus.paid: 'paid',
  InstallmentResponseDtoStatus.$unknown: r'$unknown',
};
