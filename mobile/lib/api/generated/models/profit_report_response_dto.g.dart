// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'profit_report_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProfitReportResponseDto _$ProfitReportResponseDtoFromJson(
  Map<String, dynamic> json,
) => ProfitReportResponseDto(
  groupBy: ProfitGroupBy.fromJson(json['groupBy'] as String),
  from: json['from'] as String,
  to: json['to'] as String,
  totals: ProfitFiguresDto.fromJson(json['totals'] as Map<String, dynamic>),
  rows: (json['rows'] as List<dynamic>)
      .map((e) => ProfitReportRowDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$ProfitReportResponseDtoToJson(
  ProfitReportResponseDto instance,
) => <String, dynamic>{
  'groupBy': _$ProfitGroupByEnumMap[instance.groupBy]!,
  'from': instance.from,
  'to': instance.to,
  'totals': instance.totals,
  'rows': instance.rows,
};

const _$ProfitGroupByEnumMap = {
  ProfitGroupBy.order: 'order',
  ProfitGroupBy.month: 'month',
  ProfitGroupBy.assignee: 'assignee',
  ProfitGroupBy.source: 'source',
  ProfitGroupBy.$unknown: r'$unknown',
};
