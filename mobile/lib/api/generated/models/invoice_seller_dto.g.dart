// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invoice_seller_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

InvoiceSellerDto _$InvoiceSellerDtoFromJson(Map<String, dynamic> json) =>
    InvoiceSellerDto(
      legalName: json['legalName'] as String,
      taxCode: json['taxCode'] as String,
      address: json['address'] as String,
      representative: json['representative'] as String,
      representativeTitle: json['representativeTitle'] as String,
      phone: json['phone'] as String,
      bankAccount: json['bankAccount'] as String,
    );

Map<String, dynamic> _$InvoiceSellerDtoToJson(InvoiceSellerDto instance) =>
    <String, dynamic>{
      'legalName': instance.legalName,
      'taxCode': instance.taxCode,
      'address': instance.address,
      'representative': instance.representative,
      'representativeTitle': instance.representativeTitle,
      'phone': instance.phone,
      'bankAccount': instance.bankAccount,
    };
