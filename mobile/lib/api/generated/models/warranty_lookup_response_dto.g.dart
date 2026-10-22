// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'warranty_lookup_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

WarrantyLookupResponseDto _$WarrantyLookupResponseDtoFromJson(
  Map<String, dynamic> json,
) => WarrantyLookupResponseDto(
  found: json['found'] as bool,
  phone: json['phone'] as String,
  customer: json['customer'] == null
      ? null
      : WarrantyCustomerDto.fromJson(json['customer'] as Map<String, dynamic>),
  orders: (json['orders'] as List<dynamic>)
      .map((e) => WarrantyOrderDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$WarrantyLookupResponseDtoToJson(
  WarrantyLookupResponseDto instance,
) => <String, dynamic>{
  'found': instance.found,
  'phone': instance.phone,
  'customer': instance.customer,
  'orders': instance.orders,
};
