// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invoice_pdf_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

InvoicePdfResponseDto _$InvoicePdfResponseDtoFromJson(
  Map<String, dynamic> json,
) => InvoicePdfResponseDto(
  fileName: json['fileName'] as String,
  pdfSize: json['pdfSize'] as num,
  exportedAt: DateTime.parse(json['exportedAt'] as String),
);

Map<String, dynamic> _$InvoicePdfResponseDtoToJson(
  InvoicePdfResponseDto instance,
) => <String, dynamic>{
  'fileName': instance.fileName,
  'pdfSize': instance.pdfSize,
  'exportedAt': instance.exportedAt.toIso8601String(),
};
