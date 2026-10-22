// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'warranty_customer_dto.g.dart';

@JsonSerializable()
class WarrantyCustomerDto {
  const WarrantyCustomerDto({
    required this.phone,
    required this.name,
    required this.custType,
  });
  
  factory WarrantyCustomerDto.fromJson(Map<String, Object?> json) => _$WarrantyCustomerDtoFromJson(json);
  
  final String phone;

  /// Họ tên hoặc tên công ty.
  final String name;

  /// Loại khách: CA_NHAN | THUONG_MAI.
  final String custType;

  Map<String, Object?> toJson() => _$WarrantyCustomerDtoToJson(this);
}
