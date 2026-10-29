// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'permission_transition_dto.dart';

part 'permission_option_dto.g.dart';

@JsonSerializable()
class PermissionOptionDto {
  const PermissionOptionDto({
    required this.key,
    required this.label,
    required this.group,
    required this.requires,
    required this.requiresAnyOf,
    required this.grantable,
    required this.transitions,
  });
  
  factory PermissionOptionDto.fromJson(Map<String, Object?> json) => _$PermissionOptionDtoFromJson(json);
  
  final String key;
  final String label;
  final String group;

  /// Quyền phải có kèm thì quyền này mới dùng được (thiếu ⇒ lưu bị từ chối).
  final List<String> requires;

  /// Phải có ít nhất một trong các quyền này (rỗng = không ràng buộc).
  final List<String> requiresAnyOf;

  /// Người gọi cấp được quyền này không (luật không-leo-thang).
  final bool grantable;

  /// Các bước chuyển trạng thái đơn mà quyền này điều khiển, theo thứ tự bảng (rỗng = không bước nào).
  final List<PermissionTransitionDto> transitions;

  Map<String, Object?> toJson() => _$PermissionOptionDtoToJson(this);
}
