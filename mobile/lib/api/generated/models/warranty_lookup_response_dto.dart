// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'warranty_customer_dto.dart';
import 'warranty_order_dto.dart';

part 'warranty_lookup_response_dto.g.dart';

@JsonSerializable()
class WarrantyLookupResponseDto {
  const WarrantyLookupResponseDto({
    required this.found,
    required this.phone,
    required this.customer,
    required this.orders,
  });
  
  factory WarrantyLookupResponseDto.fromJson(Map<String, Object?> json) => _$WarrantyLookupResponseDtoFromJson(json);
  
  /// Có khách hàng nào mang SĐT này chưa.
  final bool found;

  /// SĐT đã chuẩn hoá E.164 — trả về kể cả khi `found: false`.
  final String phone;

  /// Khách tìm được; `null` khi `found: false`.
  final WarrantyCustomerDto? customer;

  /// Đơn của khách ĐÃ thu hẹp theo quyền người gọi, chỉ giữ đơn còn ít nhất một dòng có bảo hành.
  final List<WarrantyOrderDto> orders;

  Map<String, Object?> toJson() => _$WarrantyLookupResponseDtoToJson(this);
}
