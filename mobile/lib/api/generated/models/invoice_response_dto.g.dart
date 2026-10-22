// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invoice_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

InvoiceResponseDto _$InvoiceResponseDtoFromJson(Map<String, dynamic> json) =>
    InvoiceResponseDto(
      id: json['id'] as String,
      invoiceNo: json['invoiceNo'] as String,
      versionNo: json['versionNo'] as num,
      issuedAt: DateTime.parse(json['issuedAt'] as String),
      customerName: json['customerName'] as String,
      customerTaxCode: json['customerTaxCode'] as String?,
      vatRate: json['vatRate'] as num,
      applyVat: json['applyVat'] as bool,
      subtotal: json['subtotal'] as num,
      discountAmount: json['discountAmount'] as num,
      vatAmount: json['vatAmount'] as num,
      total: json['total'] as num,
      lineCount: json['lineCount'] as num,
    );

Map<String, dynamic> _$InvoiceResponseDtoToJson(InvoiceResponseDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'invoiceNo': instance.invoiceNo,
      'versionNo': instance.versionNo,
      'issuedAt': instance.issuedAt.toIso8601String(),
      'customerName': instance.customerName,
      'customerTaxCode': instance.customerTaxCode,
      'vatRate': instance.vatRate,
      'applyVat': instance.applyVat,
      'subtotal': instance.subtotal,
      'discountAmount': instance.discountAmount,
      'vatAmount': instance.vatAmount,
      'total': instance.total,
      'lineCount': instance.lineCount,
    };
