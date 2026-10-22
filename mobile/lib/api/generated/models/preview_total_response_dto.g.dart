// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'preview_total_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PreviewTotalResponseDto _$PreviewTotalResponseDtoFromJson(
  Map<String, dynamic> json,
) => PreviewTotalResponseDto(
  subtotal: json['subtotal'] as num,
  discountAmount: json['discountAmount'] as num,
  vatAmount: json['vatAmount'] as num,
  total: json['total'] as num,
  vatRate: json['vatRate'] as num,
  applyVat: json['applyVat'] as bool,
);

Map<String, dynamic> _$PreviewTotalResponseDtoToJson(
  PreviewTotalResponseDto instance,
) => <String, dynamic>{
  'subtotal': instance.subtotal,
  'discountAmount': instance.discountAmount,
  'vatAmount': instance.vatAmount,
  'total': instance.total,
  'vatRate': instance.vatRate,
  'applyVat': instance.applyVat,
};
