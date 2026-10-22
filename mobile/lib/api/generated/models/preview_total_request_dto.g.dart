// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'preview_total_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PreviewTotalRequestDto _$PreviewTotalRequestDtoFromJson(
  Map<String, dynamic> json,
) => PreviewTotalRequestDto(
  lines: (json['lines'] as List<dynamic>)
      .map((e) => PreviewTotalLineDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  vatMode: json['vatMode'] == null
      ? null
      : PreviewTotalRequestDtoVatMode.fromJson(json['vatMode'] as String),
  discountAmount: json['discountAmount'] as num?,
);

Map<String, dynamic> _$PreviewTotalRequestDtoToJson(
  PreviewTotalRequestDto instance,
) => <String, dynamic>{
  'lines': instance.lines,
  'vatMode': _$PreviewTotalRequestDtoVatModeEnumMap[instance.vatMode],
  'discountAmount': instance.discountAmount,
};

const _$PreviewTotalRequestDtoVatModeEnumMap = {
  PreviewTotalRequestDtoVatMode.coVat: 'co_vat',
  PreviewTotalRequestDtoVatMode.khongVat: 'khong_vat',
  PreviewTotalRequestDtoVatMode.$unknown: r'$unknown',
};
