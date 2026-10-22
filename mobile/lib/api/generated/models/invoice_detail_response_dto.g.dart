// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invoice_detail_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

InvoiceDetailResponseDto _$InvoiceDetailResponseDtoFromJson(
  Map<String, dynamic> json,
) => InvoiceDetailResponseDto(
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
  orderId: json['orderId'] as String,
  quoteNo: json['quoteNo'] as String,
  customerPhone: json['customerPhone'] as String,
  customerAddress: json['customerAddress'] as String?,
  seller: InvoiceSellerDto.fromJson(json['seller'] as Map<String, dynamic>),
  lines: (json['lines'] as List<dynamic>)
      .map((e) => InvoiceLineDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  pdf: json['pdf'] == null
      ? null
      : InvoicePdfResponseDto.fromJson(json['pdf'] as Map<String, dynamic>),
);

Map<String, dynamic> _$InvoiceDetailResponseDtoToJson(
  InvoiceDetailResponseDto instance,
) => <String, dynamic>{
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
  'orderId': instance.orderId,
  'quoteNo': instance.quoteNo,
  'customerPhone': instance.customerPhone,
  'customerAddress': instance.customerAddress,
  'seller': instance.seller,
  'lines': instance.lines,
  'pdf': instance.pdf,
};
