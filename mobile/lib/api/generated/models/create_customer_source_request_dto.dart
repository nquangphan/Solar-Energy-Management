// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'create_customer_source_request_dto.g.dart';

@JsonSerializable()
class CreateCustomerSourceRequestDto {
  const CreateCustomerSourceRequestDto({
    required this.name,
    this.description,
    this.sortOrder,
  });
  
  factory CreateCustomerSourceRequestDto.fromJson(Map<String, Object?> json) => _$CreateCustomerSourceRequestDtoFromJson(json);
  
  /// Tên nguồn — DUY NHẤT trong danh mục (trùng ⇒ 409).
  final String name;

  /// Một câu để sale phân biệt lúc nhập ("Fanpage" và "Facebook" nghe giống nhau).
  final String? description;

  /// Thứ tự hiện trên form tạo khách. Vắng ⇒ backend xếp xuống cuối (max + 1).
  final num? sortOrder;

  Map<String, Object?> toJson() => _$CreateCustomerSourceRequestDtoToJson(this);
}
