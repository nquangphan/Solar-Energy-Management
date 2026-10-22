// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'update_customer_source_request_dto.g.dart';

@JsonSerializable()
class UpdateCustomerSourceRequestDto {
  const UpdateCustomerSourceRequestDto({
    this.name,
    this.description,
    this.sortOrder,
  });
  
  factory UpdateCustomerSourceRequestDto.fromJson(Map<String, Object?> json) => _$UpdateCustomerSourceRequestDtoFromJson(json);
  
  /// Tên nguồn mới — vẫn phải DUY NHẤT (trùng dòng khác ⇒ 409).
  final String? name;

  /// Mô tả cho người nhập. Gửi `null` để XOÁ mô tả (cột nullable).
  final String? description;

  /// Thứ tự hiện trên form tạo khách.
  final num? sortOrder;

  Map<String, Object?> toJson() => _$UpdateCustomerSourceRequestDtoToJson(this);
}
