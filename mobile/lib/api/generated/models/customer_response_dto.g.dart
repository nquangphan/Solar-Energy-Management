// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'customer_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CustomerResponseDto _$CustomerResponseDtoFromJson(Map<String, dynamic> json) =>
    CustomerResponseDto(
      phone: json['phone'] as String,
      custType: json['custType'] as String,
      name: json['name'] as String,
      sourceId: json['sourceId'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      nationalId: json['nationalId'] as String?,
      taxCode: json['taxCode'] as String?,
      address: json['address'] as String?,
      bankAccount: json['bankAccount'] as String?,
      sourceNote: json['sourceNote'] as String?,
    );

Map<String, dynamic> _$CustomerResponseDtoToJson(
  CustomerResponseDto instance,
) => <String, dynamic>{
  'phone': instance.phone,
  'custType': instance.custType,
  'name': instance.name,
  'nationalId': instance.nationalId,
  'taxCode': instance.taxCode,
  'address': instance.address,
  'bankAccount': instance.bankAccount,
  'sourceId': instance.sourceId,
  'sourceNote': instance.sourceNote,
  'createdAt': instance.createdAt.toIso8601String(),
  'updatedAt': instance.updatedAt.toIso8601String(),
};
