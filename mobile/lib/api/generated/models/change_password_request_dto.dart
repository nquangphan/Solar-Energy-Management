// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'change_password_request_dto.g.dart';

@JsonSerializable()
class ChangePasswordRequestDto {
  const ChangePasswordRequestDto({
    required this.currentPassword,
    required this.newPassword,
  });
  
  factory ChangePasswordRequestDto.fromJson(Map<String, Object?> json) => _$ChangePasswordRequestDtoFromJson(json);
  
  /// Mật khẩu hiện tại — bắt buộc để một phiên bị chiếm không tự đổi được.
  final String currentPassword;

  /// Mật khẩu mới. Tối thiểu 8 ký tự, có chữ và số. Phải khác mật khẩu hiện tại.
  final String newPassword;

  Map<String, Object?> toJson() => _$ChangePasswordRequestDtoToJson(this);
}
