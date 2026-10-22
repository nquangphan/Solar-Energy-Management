// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'forgot_password_response_dto.g.dart';

@JsonSerializable()
class ForgotPasswordResponseDto {
  const ForgotPasswordResponseDto({
    required this.expiresInSeconds,
  });
  
  factory ForgotPasswordResponseDto.fromJson(Map<String, Object?> json) => _$ForgotPasswordResponseDtoFromJson(json);
  
  /// Số giây mã xác thực còn hiệu lực. Hằng số từ config — không tiết lộ tài khoản có tồn tại hay không.
  final num expiresInSeconds;

  Map<String, Object?> toJson() => _$ForgotPasswordResponseDtoToJson(this);
}
