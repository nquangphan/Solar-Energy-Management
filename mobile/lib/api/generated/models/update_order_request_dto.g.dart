// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_order_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateOrderRequestDto _$UpdateOrderRequestDtoFromJson(
  Map<String, dynamic> json,
) => UpdateOrderRequestDto(
  scopeConstruction: json['scopeConstruction'] as bool?,
  scopeDelivery: json['scopeDelivery'] as bool?,
  vatMode: json['vatMode'] == null
      ? null
      : UpdateOrderRequestDtoVatMode.fromJson(json['vatMode'] as String),
  kWp: json['kWp'] as num?,
  validityNote: json['validityNote'] as String?,
);

Map<String, dynamic> _$UpdateOrderRequestDtoToJson(
  UpdateOrderRequestDto instance,
) => <String, dynamic>{
  'scopeConstruction': instance.scopeConstruction,
  'scopeDelivery': instance.scopeDelivery,
  'vatMode': _$UpdateOrderRequestDtoVatModeEnumMap[instance.vatMode],
  'kWp': instance.kWp,
  'validityNote': instance.validityNote,
};

const _$UpdateOrderRequestDtoVatModeEnumMap = {
  UpdateOrderRequestDtoVatMode.coVat: 'co_vat',
  UpdateOrderRequestDtoVatMode.khongVat: 'khong_vat',
  UpdateOrderRequestDtoVatMode.$unknown: r'$unknown',
};
