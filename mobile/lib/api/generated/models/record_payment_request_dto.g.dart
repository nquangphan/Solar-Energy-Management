// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'record_payment_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RecordPaymentRequestDto _$RecordPaymentRequestDtoFromJson(
  Map<String, dynamic> json,
) => RecordPaymentRequestDto(
  idempotencyKey: json['idempotencyKey'] as String,
  installmentId: json['installmentId'] as String,
  amount: json['amount'] as num,
  paidOn: json['paidOn'] as String,
  method: RecordPaymentRequestDtoMethod.fromJson(json['method'] as String),
  note: json['note'] as String?,
);

Map<String, dynamic> _$RecordPaymentRequestDtoToJson(
  RecordPaymentRequestDto instance,
) => <String, dynamic>{
  'idempotencyKey': instance.idempotencyKey,
  'installmentId': instance.installmentId,
  'amount': instance.amount,
  'paidOn': instance.paidOn,
  'method': _$RecordPaymentRequestDtoMethodEnumMap[instance.method]!,
  'note': instance.note,
};

const _$RecordPaymentRequestDtoMethodEnumMap = {
  RecordPaymentRequestDtoMethod.bankTransfer: 'bank_transfer',
  RecordPaymentRequestDtoMethod.cash: 'cash',
  RecordPaymentRequestDtoMethod.$unknown: r'$unknown',
};
