// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'forgot_password_request_dto.g.dart';

@JsonSerializable()
class ForgotPasswordRequestDto {
  const ForgotPasswordRequestDto({
    required this.email,
  });
  
  factory ForgotPasswordRequestDto.fromJson(Map<String, Object?> json) => _$ForgotPasswordRequestDtoFromJson(json);
  
  /// Email đã đăng ký của tài khoản cần đặt lại mật khẩu.
  final String email;

  Map<String, Object?> toJson() => _$ForgotPasswordRequestDtoToJson(this);
}
