// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'stock_voucher_list_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StockVoucherListResponseDto _$StockVoucherListResponseDtoFromJson(
  Map<String, dynamic> json,
) => StockVoucherListResponseDto(
  items: (json['items'] as List<dynamic>)
      .map((e) => StockVoucherSummaryDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$StockVoucherListResponseDtoToJson(
  StockVoucherListResponseDto instance,
) => <String, dynamic>{'items': instance.items};
