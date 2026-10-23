// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_summary_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DashboardSummaryResponseDto _$DashboardSummaryResponseDtoFromJson(
  Map<String, dynamic> json,
) => DashboardSummaryResponseDto(
  period: DashboardSummaryResponseDtoPeriod.fromJson(json['period'] as String),
  from: json['from'] as String,
  to: json['to'] as String,
  revenue: (json['revenue'] as num?)?.toInt(),
  newOrderCount: (json['newOrderCount'] as num?)?.toInt(),
  ordersByStatus: (json['ordersByStatus'] as List<dynamic>?)
      ?.map((e) => DashboardStatusCountDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$DashboardSummaryResponseDtoToJson(
  DashboardSummaryResponseDto instance,
) => <String, dynamic>{
  'period': _$DashboardSummaryResponseDtoPeriodEnumMap[instance.period]!,
  'from': instance.from,
  'to': instance.to,
  'revenue': instance.revenue,
  'newOrderCount': instance.newOrderCount,
  'ordersByStatus': instance.ordersByStatus,
};

const _$DashboardSummaryResponseDtoPeriodEnumMap = {
  DashboardSummaryResponseDtoPeriod.day: 'day',
  DashboardSummaryResponseDtoPeriod.week: 'week',
  DashboardSummaryResponseDtoPeriod.month: 'month',
  DashboardSummaryResponseDtoPeriod.$unknown: r'$unknown',
};
