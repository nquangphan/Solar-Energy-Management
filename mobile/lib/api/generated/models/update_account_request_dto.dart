// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'update_account_request_dto.g.dart';

@JsonSerializable()
class UpdateAccountRequestDto {
  const UpdateAccountRequestDto({
    required this.displayName,
    required this.phone,
    required this.email,
    required this.isActive,
  });
  
  factory UpdateAccountRequestDto.fromJson(Map<String, Object?> json) => _$UpdateAccountRequestDtoFromJson(json);
  
  /// Họ tên hiển thị.
  final String displayName;

  /// SĐT đăng nhập dạng THÔ — backend chuẩn hoá về E.164. Không hợp lệ ⇒ 400, trùng ⇒ 409.
  final String phone;

  /// Email liên hệ (backend trim + lowercase). Trùng ⇒ 409.
  final String email;

  /// false = vô hiệu hoá (thu hồi mọi phiên).
  final bool isActive;

  Map<String, Object?> toJson() => _$UpdateAccountRequestDtoToJson(this);
}
