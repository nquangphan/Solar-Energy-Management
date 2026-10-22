// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_stock_issue_view_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderStockIssueViewDto _$OrderStockIssueViewDtoFromJson(
  Map<String, dynamic> json,
) => OrderStockIssueViewDto(
  issued: json['issued'] as bool,
  canIssue: json['canIssue'] as bool,
  blocked: json['blocked'] as bool,
  lines: (json['lines'] as List<dynamic>)
      .map((e) => OrderStockIssueLineDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  untrackedItems: (json['untrackedItems'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
  voucher: json['voucher'] == null
      ? null
      : StockVoucherDetailDto.fromJson(json['voucher'] as Map<String, dynamic>),
);

Map<String, dynamic> _$OrderStockIssueViewDtoToJson(
  OrderStockIssueViewDto instance,
) => <String, dynamic>{
  'issued': instance.issued,
  'voucher': instance.voucher,
  'canIssue': instance.canIssue,
  'blocked': instance.blocked,
  'lines': instance.lines,
  'untrackedItems': instance.untrackedItems,
};
