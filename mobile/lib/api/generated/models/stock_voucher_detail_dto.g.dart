// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'stock_voucher_detail_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StockVoucherDetailDto _$StockVoucherDetailDtoFromJson(
  Map<String, dynamic> json,
) => StockVoucherDetailDto(
  id: json['id'] as String,
  code: json['code'] as String,
  type: StockVoucherDetailDtoType.fromJson(json['type'] as String),
  createdAt: DateTime.parse(json['createdAt'] as String),
  createdBy: StockVoucherCreatorDto.fromJson(
    json['createdBy'] as Map<String, dynamic>,
  ),
  lineCount: json['lineCount'] as num,
  totalQty: json['totalQty'] as num,
  note: json['note'] as String?,
  lines: (json['lines'] as List<dynamic>)
      .map(
        (e) => StockVoucherLineResponseDto.fromJson(e as Map<String, dynamic>),
      )
      .toList(),
  canReturn: json['canReturn'] as bool,
  orderId: json['orderId'] as String?,
  returnOfVoucherId: json['returnOfVoucherId'] as String?,
  returnOf: json['returnOf'] == null
      ? null
      : StockVoucherReturnOfDto.fromJson(
          json['returnOf'] as Map<String, dynamic>,
        ),
  returnVoucher: json['returnVoucher'] == null
      ? null
      : StockVoucherReturnRefDto.fromJson(
          json['returnVoucher'] as Map<String, dynamic>,
        ),
);

Map<String, dynamic> _$StockVoucherDetailDtoToJson(
  StockVoucherDetailDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'type': _$StockVoucherDetailDtoTypeEnumMap[instance.type]!,
  'orderId': instance.orderId,
  'returnOfVoucherId': instance.returnOfVoucherId,
  'createdAt': instance.createdAt.toIso8601String(),
  'createdBy': instance.createdBy,
  'lineCount': instance.lineCount,
  'totalQty': instance.totalQty,
  'note': instance.note,
  'lines': instance.lines,
  'returnOf': instance.returnOf,
  'returnVoucher': instance.returnVoucher,
  'canReturn': instance.canReturn,
};

const _$StockVoucherDetailDtoTypeEnumMap = {
  StockVoucherDetailDtoType.nhap: 'nhap',
  StockVoucherDetailDtoType.xuat: 'xuat',
  StockVoucherDetailDtoType.$unknown: r'$unknown',
};
