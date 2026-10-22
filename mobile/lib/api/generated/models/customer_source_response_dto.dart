// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'customer_source_response_dto.g.dart';

@JsonSerializable()
class CustomerSourceResponseDto {
  const CustomerSourceResponseDto({
    required this.id,
    required this.name,
    required this.active,
    required this.sortOrder,
    required this.isOther,
    this.description,
  });
  
  factory CustomerSourceResponseDto.fromJson(Map<String, Object?> json) => _$CustomerSourceResponseDtoFromJson(json);
  
  final String id;
  final String name;
  final String? description;

  /// false = nguồn đã ngừng dùng.
  final bool active;

  /// Thứ tự hiển thị trong form.
  final num sortOrder;

  /// true = nguồn "Khác" ⇒ chọn nó thì `sourceNote` BẮT BUỘC. Đúng một dòng mang cờ này.
  final bool isOther;

  Map<String, Object?> toJson() => _$CustomerSourceResponseDtoToJson(this);
}
