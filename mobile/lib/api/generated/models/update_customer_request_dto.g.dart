// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_customer_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateCustomerRequestDto _$UpdateCustomerRequestDtoFromJson(
  Map<String, dynamic> json,
) => UpdateCustomerRequestDto(
  phone: json['phone'] as String?,
  custType: json['custType'] == null
      ? null
      : UpdateCustomerRequestDtoCustType.fromJson(json['custType'] as String),
  name: json['name'] as String?,
  nationalId: json['nationalId'] as String?,
  taxCode: json['taxCode'] as String?,
  address: json['address'] as String?,
  bankAccount: json['bankAccount'] as String?,
  sourceId: json['sourceId'] as String?,
  sourceNote: json['sourceNote'] as String?,
);

Map<String, dynamic> _$UpdateCustomerRequestDtoToJson(
  UpdateCustomerRequestDto instance,
) => <String, dynamic>{
  'phone': instance.phone,
  'custType': _$UpdateCustomerRequestDtoCustTypeEnumMap[instance.custType],
  'name': instance.name,
  'nationalId': instance.nationalId,
  'taxCode': instance.taxCode,
  'address': instance.address,
  'bankAccount': instance.bankAccount,
  'sourceId': instance.sourceId,
  'sourceNote': instance.sourceNote,
};

const _$UpdateCustomerRequestDtoCustTypeEnumMap = {
  UpdateCustomerRequestDtoCustType.caNhan: 'CA_NHAN',
  UpdateCustomerRequestDtoCustType.thuongMai: 'THUONG_MAI',
  UpdateCustomerRequestDtoCustType.$unknown: r'$unknown',
};
