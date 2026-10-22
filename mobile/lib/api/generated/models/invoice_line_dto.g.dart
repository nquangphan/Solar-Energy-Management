// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invoice_line_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

InvoiceLineDto _$InvoiceLineDtoFromJson(Map<String, dynamic> json) =>
    InvoiceLineDto(
      displayOrder: json['displayOrder'] as num,
      name: json['name'] as String,
      unit: json['unit'] as String,
      qty: json['qty'] as num,
      unitPrice: json['unitPrice'] as num,
      amount: json['amount'] as num,
    );

Map<String, dynamic> _$InvoiceLineDtoToJson(InvoiceLineDto instance) =>
    <String, dynamic>{
      'displayOrder': instance.displayOrder,
      'name': instance.name,
      'unit': instance.unit,
      'qty': instance.qty,
      'unitPrice': instance.unitPrice,
      'amount': instance.amount,
    };
