// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'payment_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PaymentResponseDto _$PaymentResponseDtoFromJson(Map<String, dynamic> json) =>
    PaymentResponseDto(
      id: json['id'] as String,
      installmentId: json['installmentId'] as String,
      amount: json['amount'] as num,
      paidOn: json['paidOn'] as String,
      method: PaymentResponseDtoMethod.fromJson(json['method'] as String),
      note: json['note'] as String?,
      recordedAt: DateTime.parse(json['recordedAt'] as String),
    );

Map<String, dynamic> _$PaymentResponseDtoToJson(PaymentResponseDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'installmentId': instance.installmentId,
      'amount': instance.amount,
      'paidOn': instance.paidOn,
      'method': _$PaymentResponseDtoMethodEnumMap[instance.method]!,
      'note': instance.note,
      'recordedAt': instance.recordedAt.toIso8601String(),
    };

const _$PaymentResponseDtoMethodEnumMap = {
  PaymentResponseDtoMethod.bankTransfer: 'bank_transfer',
  PaymentResponseDtoMethod.cash: 'cash',
  PaymentResponseDtoMethod.$unknown: r'$unknown',
};
