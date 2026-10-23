// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'role_preset.dart';

part 'account_permission_summary_dto.g.dart';

@JsonSerializable()
class AccountPermissionSummaryDto {
  const AccountPermissionSummaryDto({
    required this.id,
    required this.displayName,
    required this.phone,
    required this.email,
    required this.isActive,
    required this.permissions,
    required this.matchingPreset,
    required this.matchingPresetLabel,
    required this.editable,
    required this.readOnlyReason,
  });
  
  factory AccountPermissionSummaryDto.fromJson(Map<String, Object?> json) => _$AccountPermissionSummaryDtoFromJson(json);
  
  final String id;
  final String displayName;

  /// SĐT đăng nhập (E.164). null với account cũ chưa có số.
  final String? phone;
  final String email;

  /// false = account đã vô hiệu.
  final bool isActive;

  /// Bộ quyền đang lưu trên account (sorted).
  final List<String> permissions;

  /// Preset có bộ quyền trùng khít bộ quyền của account; null = tuỳ chỉnh. Account không lưu role.
  final RolePreset? matchingPreset;

  /// Nhãn tiếng Việt của matchingPreset (kể cả preset người gọi không cấp được); null = tuỳ chỉnh.
  final String? matchingPresetLabel;

  /// Người gọi có sửa được quyền của account này không (không phải chính mình, và account không mang quyền người gọi không có).
  final bool editable;

  /// Lý do chỉ đọc khi editable = false; null khi sửa được.
  final String? readOnlyReason;

  Map<String, Object?> toJson() => _$AccountPermissionSummaryDtoToJson(this);
}
