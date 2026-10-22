// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'installment_input_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

InstallmentInputDto _$InstallmentInputDtoFromJson(Map<String, dynamic> json) =>
    InstallmentInputDto(
      conditionNote: json['conditionNote'] as String,
      percent: json['percent'] as num?,
      amount: json['amount'] as num?,
    );

Map<String, dynamic> _$InstallmentInputDtoToJson(
  InstallmentInputDto instance,
) => <String, dynamic>{
  'percent': instance.percent,
  'amount': instance.amount,
  'conditionNote': instance.conditionNote,
};
