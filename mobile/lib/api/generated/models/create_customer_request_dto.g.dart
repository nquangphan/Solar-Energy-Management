// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_customer_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateCustomerRequestDto _$CreateCustomerRequestDtoFromJson(
  Map<String, dynamic> json,
) => CreateCustomerRequestDto(
  phone: json['phone'] as String,
  custType: CreateCustomerRequestDtoCustType.fromJson(
    json['custType'] as String,
  ),
  name: json['name'] as String,
  sourceId: json['sourceId'] as String,
  nationalId: json['nationalId'] as String?,
  taxCode: json['taxCode'] as String?,
  address: json['address'] as String?,
  bankAccount: json['bankAccount'] as String?,
  sourceNote: json['sourceNote'] as String?,
);

Map<String, dynamic> _$CreateCustomerRequestDtoToJson(
  CreateCustomerRequestDto instance,
) => <String, dynamic>{
  'phone': instance.phone,
  'custType': _$CreateCustomerRequestDtoCustTypeEnumMap[instance.custType]!,
  'name': instance.name,
  'nationalId': instance.nationalId,
  'taxCode': instance.taxCode,
  'address': instance.address,
  'bankAccount': instance.bankAccount,
  'sourceId': instance.sourceId,
  'sourceNote': instance.sourceNote,
};

const _$CreateCustomerRequestDtoCustTypeEnumMap = {
  CreateCustomerRequestDtoCustType.caNhan: 'CA_NHAN',
  CreateCustomerRequestDtoCustType.thuongMai: 'THUONG_MAI',
  CreateCustomerRequestDtoCustType.$unknown: r'$unknown',
};
