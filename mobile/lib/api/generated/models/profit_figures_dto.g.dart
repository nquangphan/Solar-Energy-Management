// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'profit_figures_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProfitFiguresDto _$ProfitFiguresDtoFromJson(Map<String, dynamic> json) =>
    ProfitFiguresDto(
      revenue: (json['revenue'] as num).toInt(),
      cost: (json['cost'] as num).toInt(),
      grossProfit: (json['grossProfit'] as num).toInt(),
      marginPct: (json['marginPct'] as num?)?.toInt(),
      orderCount: (json['orderCount'] as num).toInt(),
    );

Map<String, dynamic> _$ProfitFiguresDtoToJson(ProfitFiguresDto instance) =>
    <String, dynamic>{
      'revenue': instance.revenue,
      'cost': instance.cost,
      'grossProfit': instance.grossProfit,
      'marginPct': instance.marginPct,
      'orderCount': instance.orderCount,
    };
