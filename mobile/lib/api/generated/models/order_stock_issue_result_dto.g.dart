// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_stock_issue_result_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderStockIssueResultDto _$OrderStockIssueResultDtoFromJson(
  Map<String, dynamic> json,
) => OrderStockIssueResultDto(
  voucher: StockVoucherDetailDto.fromJson(
    json['voucher'] as Map<String, dynamic>,
  ),
);

Map<String, dynamic> _$OrderStockIssueResultDtoToJson(
  OrderStockIssueResultDto instance,
) => <String, dynamic>{'voucher': instance.voucher};
