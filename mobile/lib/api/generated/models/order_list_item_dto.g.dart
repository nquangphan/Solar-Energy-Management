// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_list_item_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderListItemDto _$OrderListItemDtoFromJson(Map<String, dynamic> json) =>
    OrderListItemDto(
      id: json['id'] as String,
      status: OrderListItemDtoStatus.fromJson(json['status'] as String),
      customerPhone: json['customerPhone'] as String,
      customerName: json['customerName'] as String,
      ownerAccountId: json['ownerAccountId'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      assigneeAccountId: json['assigneeAccountId'] as String?,
    );

Map<String, dynamic> _$OrderListItemDtoToJson(OrderListItemDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'status': _$OrderListItemDtoStatusEnumMap[instance.status]!,
      'customerPhone': instance.customerPhone,
      'customerName': instance.customerName,
      'ownerAccountId': instance.ownerAccountId,
      'assigneeAccountId': instance.assigneeAccountId,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

const _$OrderListItemDtoStatusEnumMap = {
  OrderListItemDtoStatus.baogia: 'baogia',
  OrderListItemDtoStatus.choduyet: 'choduyet',
  OrderListItemDtoStatus.dachot: 'dachot',
  OrderListItemDtoStatus.dacoc: 'dacoc',
  OrderListItemDtoStatus.thicong: 'thicong',
  OrderListItemDtoStatus.nghiemthu: 'nghiemthu',
  OrderListItemDtoStatus.danggiao: 'danggiao',
  OrderListItemDtoStatus.dagiao: 'dagiao',
  OrderListItemDtoStatus.hoanthanh: 'hoanthanh',
  OrderListItemDtoStatus.huy: 'huy',
  OrderListItemDtoStatus.$unknown: r'$unknown',
};
