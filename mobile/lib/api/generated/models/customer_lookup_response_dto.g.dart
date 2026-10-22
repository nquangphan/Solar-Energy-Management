// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'customer_lookup_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CustomerLookupResponseDto _$CustomerLookupResponseDtoFromJson(
  Map<String, dynamic> json,
) => CustomerLookupResponseDto(
  found: json['found'] as bool,
  phone: json['phone'] as String,
  customer: json['customer'] == null
      ? null
      : CustomerResponseDto.fromJson(json['customer'] as Map<String, dynamic>),
);

Map<String, dynamic> _$CustomerLookupResponseDtoToJson(
  CustomerLookupResponseDto instance,
) => <String, dynamic>{
  'found': instance.found,
  'phone': instance.phone,
  'customer': instance.customer,
};
