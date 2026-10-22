// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'quote_export_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

QuoteExportResponseDto _$QuoteExportResponseDtoFromJson(
  Map<String, dynamic> json,
) => QuoteExportResponseDto(
  orderId: json['orderId'] as String,
  orderVersionId: json['orderVersionId'] as String,
  exportedAt: DateTime.parse(json['exportedAt'] as String),
  image: QuoteExportFileDto.fromJson(json['image'] as Map<String, dynamic>),
  pdf: QuoteExportFileDto.fromJson(json['pdf'] as Map<String, dynamic>),
);

Map<String, dynamic> _$QuoteExportResponseDtoToJson(
  QuoteExportResponseDto instance,
) => <String, dynamic>{
  'orderId': instance.orderId,
  'orderVersionId': instance.orderVersionId,
  'exportedAt': instance.exportedAt.toIso8601String(),
  'image': instance.image,
  'pdf': instance.pdf,
};
