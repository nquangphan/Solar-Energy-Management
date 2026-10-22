// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'payment_schedule_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PaymentScheduleResponseDto _$PaymentScheduleResponseDtoFromJson(
  Map<String, dynamic> json,
) => PaymentScheduleResponseDto(
  orderId: json['orderId'] as String,
  configured: json['configured'] as bool,
  editable: json['editable'] as bool,
  orderTotal: json['orderTotal'] as num,
  scheduledTotal: json['scheduledTotal'] as num,
  difference: json['difference'] as num,
  totalMatches: json['totalMatches'] as bool,
  paidTotal: json['paidTotal'] as num,
  remainingTotal: json['remainingTotal'] as num,
  paidPercent: json['paidPercent'] as num,
  paymentStatus: PaymentScheduleResponseDtoPaymentStatus.fromJson(
    json['paymentStatus'] as String,
  ),
  recordable: json['recordable'] as bool,
  installments: (json['installments'] as List<dynamic>)
      .map((e) => InstallmentResponseDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  updatedAt: json['updatedAt'] == null
      ? null
      : DateTime.parse(json['updatedAt'] as String),
);

Map<String, dynamic> _$PaymentScheduleResponseDtoToJson(
  PaymentScheduleResponseDto instance,
) => <String, dynamic>{
  'orderId': instance.orderId,
  'configured': instance.configured,
  'editable': instance.editable,
  'orderTotal': instance.orderTotal,
  'scheduledTotal': instance.scheduledTotal,
  'difference': instance.difference,
  'totalMatches': instance.totalMatches,
  'paidTotal': instance.paidTotal,
  'remainingTotal': instance.remainingTotal,
  'paidPercent': instance.paidPercent,
  'paymentStatus':
      _$PaymentScheduleResponseDtoPaymentStatusEnumMap[instance.paymentStatus]!,
  'recordable': instance.recordable,
  'installments': instance.installments,
  'updatedAt': instance.updatedAt?.toIso8601String(),
};

const _$PaymentScheduleResponseDtoPaymentStatusEnumMap = {
  PaymentScheduleResponseDtoPaymentStatus.unpaid: 'unpaid',
  PaymentScheduleResponseDtoPaymentStatus.partial: 'partial',
  PaymentScheduleResponseDtoPaymentStatus.paid: 'paid',
  PaymentScheduleResponseDtoPaymentStatus.$unknown: r'$unknown',
};
