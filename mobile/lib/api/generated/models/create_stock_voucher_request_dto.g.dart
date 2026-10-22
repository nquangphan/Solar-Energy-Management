// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_stock_voucher_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateStockVoucherRequestDto _$CreateStockVoucherRequestDtoFromJson(
  Map<String, dynamic> json,
) => CreateStockVoucherRequestDto(
  type: CreateStockVoucherRequestDtoType.fromJson(json['type'] as String),
  lines: (json['lines'] as List<dynamic>)
      .map(
        (e) => StockVoucherLineRequestDto.fromJson(e as Map<String, dynamic>),
      )
      .toList(),
  note: json['note'] as String?,
);

Map<String, dynamic> _$CreateStockVoucherRequestDtoToJson(
  CreateStockVoucherRequestDto instance,
) => <String, dynamic>{
  'type': _$CreateStockVoucherRequestDtoTypeEnumMap[instance.type]!,
  'note': instance.note,
  'lines': instance.lines,
};

const _$CreateStockVoucherRequestDtoTypeEnumMap = {
  CreateStockVoucherRequestDtoType.nhap: 'nhap',
  CreateStockVoucherRequestDtoType.xuat: 'xuat',
  CreateStockVoucherRequestDtoType.$unknown: r'$unknown',
};
