// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'role_preset.dart';

part 'create_account_request_dto.g.dart';

@JsonSerializable()
class CreateAccountRequestDto {
  const CreateAccountRequestDto({
    required this.displayName,
    required this.phone,
    required this.email,
    required this.password,
    required this.preset,
    required this.isActive,
  });
  
  factory CreateAccountRequestDto.fromJson(Map<String, Object?> json) => _$CreateAccountRequestDtoFromJson(json);
  
  /// Họ tên hiển thị.
  final String displayName;

  /// SĐT đăng nhập dạng THÔ — backend chuẩn hoá về E.164. Không hợp lệ ⇒ 400, trùng ⇒ 409.
  final String phone;

  /// Email liên hệ (backend trim + lowercase). Trùng ⇒ 409.
  final String email;

  /// Mật khẩu ban đầu — tối thiểu 8 ký tự, có chữ và số.
  final String password;

  /// Preset nạp bộ quyền mặc định lúc tạo. Preset người gọi không cấp trọn được ⇒ 403.
  final RolePreset preset;

  /// false = tạo ở trạng thái tạm khoá.
  final bool isActive;

  Map<String, Object?> toJson() => _$CreateAccountRequestDtoToJson(this);
}
