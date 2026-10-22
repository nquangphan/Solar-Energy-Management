// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'reset_password_request_dto.g.dart';

@JsonSerializable()
class ResetPasswordRequestDto {
  const ResetPasswordRequestDto({
    required this.phone,
    required this.code,
    required this.newPassword,
  });
  
  factory ResetPasswordRequestDto.fromJson(Map<String, Object?> json) => _$ResetPasswordRequestDtoFromJson(json);
  
  /// SĐT đã đăng ký (cùng số đã yêu cầu mã), dạng THÔ.
  final String phone;

  /// Mã xác thực 6 chữ số đã nhận.
  final String code;

  /// Mật khẩu mới. Tối thiểu 8 ký tự, có chữ và số.
  final String newPassword;

  Map<String, Object?> toJson() => _$ResetPasswordRequestDtoToJson(this);
}
