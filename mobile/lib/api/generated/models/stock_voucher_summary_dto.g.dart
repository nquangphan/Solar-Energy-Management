// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'stock_voucher_summary_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StockVoucherSummaryDto _$StockVoucherSummaryDtoFromJson(
  Map<String, dynamic> json,
) => StockVoucherSummaryDto(
  id: json['id'] as String,
  code: json['code'] as String,
  type: StockVoucherSummaryDtoType.fromJson(json['type'] as String),
  createdAt: DateTime.parse(json['createdAt'] as String),
  createdBy: StockVoucherCreatorDto.fromJson(
    json['createdBy'] as Map<String, dynamic>,
  ),
  lineCount: json['lineCount'] as num,
  totalQty: json['totalQty'] as num,
  orderId: json['orderId'] as String?,
  returnOfVoucherId: json['returnOfVoucherId'] as String?,
);

Map<String, dynamic> _$StockVoucherSummaryDtoToJson(
  StockVoucherSummaryDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'type': _$StockVoucherSummaryDtoTypeEnumMap[instance.type]!,
  'orderId': instance.orderId,
  'returnOfVoucherId': instance.returnOfVoucherId,
  'createdAt': instance.createdAt.toIso8601String(),
  'createdBy': instance.createdBy,
  'lineCount': instance.lineCount,
  'totalQty': instance.totalQty,
};

const _$StockVoucherSummaryDtoTypeEnumMap = {
  StockVoucherSummaryDtoType.nhap: 'nhap',
  StockVoucherSummaryDtoType.xuat: 'xuat',
  StockVoucherSummaryDtoType.$unknown: r'$unknown',
};
