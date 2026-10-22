// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'login_request_dto.g.dart';

@JsonSerializable()
class LoginRequestDto {
  const LoginRequestDto({
    required this.email,
    required this.password,
  });
  
  factory LoginRequestDto.fromJson(Map<String, Object?> json) => _$LoginRequestDtoFromJson(json);
  
  /// Email đăng nhập.
  final String email;

  /// Mật khẩu.
  final String password;

  Map<String, Object?> toJson() => _$LoginRequestDtoToJson(this);
}
