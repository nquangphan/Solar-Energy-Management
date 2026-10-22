// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'customer_response_dto.dart';

part 'customer_lookup_response_dto.g.dart';

@JsonSerializable()
class CustomerLookupResponseDto {
  const CustomerLookupResponseDto({
    required this.found,
    required this.phone,
    required this.customer,
  });
  
  factory CustomerLookupResponseDto.fromJson(Map<String, Object?> json) => _$CustomerLookupResponseDtoFromJson(json);
  
  /// Có khách hàng nào mang SĐT này chưa.
  final bool found;

  /// SĐT đã chuẩn hoá E.164 — trả về kể cả khi `found: false` (form tạo khách dùng lại chuỗi này).
  final String phone;

  /// Khách hàng tìm được; `null` khi `found: false`.
  final CustomerResponseDto? customer;

  Map<String, Object?> toJson() => _$CustomerLookupResponseDtoToJson(this);
}
