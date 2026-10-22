// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderResponseDto _$OrderResponseDtoFromJson(Map<String, dynamic> json) =>
    OrderResponseDto(
      id: json['id'] as String,
      status: json['status'] as String,
      customerPhone: json['customerPhone'] as String,
      ownerAccountId: json['ownerAccountId'] as String,
      sourceId: json['sourceId'] as String,
      custType: json['custType'] as String,
      scopeEquipment: json['scopeEquipment'] as bool,
      scopeConstruction: json['scopeConstruction'] as bool,
      scopeDelivery: json['scopeDelivery'] as bool,
      lineItems: (json['lineItems'] as List<dynamic>)
          .map(
            (e) => OrderLineItemResponseDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      currentVersionId: json['currentVersionId'] as String?,
      assigneeAccountId: json['assigneeAccountId'] as String?,
      kWp: json['kWp'] as num?,
      vatMode: json['vatMode'] == null
          ? null
          : OrderResponseDtoVatMode.fromJson(json['vatMode'] as String),
      validityNote: json['validityNote'] as String?,
      cancelReason: json['cancelReason'] as String?,
      cancelledAt: json['cancelledAt'] == null
          ? null
          : DateTime.parse(json['cancelledAt'] as String),
      discount: json['discount'] == null
          ? null
          : OrderDiscountDto.fromJson(json['discount'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$OrderResponseDtoToJson(OrderResponseDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'status': instance.status,
      'customerPhone': instance.customerPhone,
      'currentVersionId': instance.currentVersionId,
      'ownerAccountId': instance.ownerAccountId,
      'assigneeAccountId': instance.assigneeAccountId,
      'sourceId': instance.sourceId,
      'custType': instance.custType,
      'scopeEquipment': instance.scopeEquipment,
      'scopeConstruction': instance.scopeConstruction,
      'scopeDelivery': instance.scopeDelivery,
      'kWp': instance.kWp,
      'vatMode': _$OrderResponseDtoVatModeEnumMap[instance.vatMode],
      'validityNote': instance.validityNote,
      'cancelReason': instance.cancelReason,
      'cancelledAt': instance.cancelledAt?.toIso8601String(),
      'lineItems': instance.lineItems,
      'discount': instance.discount,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

const _$OrderResponseDtoVatModeEnumMap = {
  OrderResponseDtoVatMode.coVat: 'co_vat',
  OrderResponseDtoVatMode.khongVat: 'khong_vat',
  OrderResponseDtoVatMode.$unknown: r'$unknown',
};
