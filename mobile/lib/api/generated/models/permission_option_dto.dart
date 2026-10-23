// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'permission_option_dto.g.dart';

@JsonSerializable()
class PermissionOptionDto {
  const PermissionOptionDto({
    required this.key,
    required this.label,
    required this.group,
    required this.requires,
    required this.grantable,
  });
  
  factory PermissionOptionDto.fromJson(Map<String, Object?> json) => _$PermissionOptionDtoFromJson(json);
  
  final String key;
  final String label;
  final String group;

  /// Quyền phải có kèm thì quyền này mới dùng được (thiếu ⇒ lưu bị từ chối).
  final List<String> requires;

  /// Người gọi cấp được quyền này không (luật không-leo-thang).
  final bool grantable;

  Map<String, Object?> toJson() => _$PermissionOptionDtoToJson(this);
}
