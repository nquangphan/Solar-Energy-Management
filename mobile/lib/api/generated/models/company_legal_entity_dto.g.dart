// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'company_legal_entity_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CompanyLegalEntityDto _$CompanyLegalEntityDtoFromJson(
  Map<String, dynamic> json,
) => CompanyLegalEntityDto(
  legalName: json['legalName'] as String,
  taxCode: json['taxCode'] as String,
  address: json['address'] as String,
  representative: json['representative'] as String,
  representativeTitle: json['representativeTitle'] as String,
  phone: json['phone'] as String,
  bankAccount: json['bankAccount'] as String,
);

Map<String, dynamic> _$CompanyLegalEntityDtoToJson(
  CompanyLegalEntityDto instance,
) => <String, dynamic>{
  'legalName': instance.legalName,
  'taxCode': instance.taxCode,
  'address': instance.address,
  'representative': instance.representative,
  'representativeTitle': instance.representativeTitle,
  'phone': instance.phone,
  'bankAccount': instance.bankAccount,
};
