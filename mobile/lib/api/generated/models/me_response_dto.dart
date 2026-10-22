// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'me_response_dto.g.dart';

@JsonSerializable()
class MeResponseDto {
  const MeResponseDto({
    required this.id,
    required this.email,
    required this.displayName,
    required this.permissions,
  });
  
  factory MeResponseDto.fromJson(Map<String, Object?> json) => _$MeResponseDtoFromJson(json);
  
  /// ID account (UUID).
  final String id;

  /// Email đăng nhập.
  final String email;

  /// Tên hiển thị.
  final String displayName;

  /// Bộ quyền hiệu lực (sorted, tất định), mỗi phần tử là một key trong `openapi/permissions.json`; FE dựng `PermissionSet` từ mảng này.
  final List<String> permissions;

  Map<String, Object?> toJson() => _$MeResponseDtoToJson(this);
}
