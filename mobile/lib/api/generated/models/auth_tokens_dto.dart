// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'auth_tokens_dto.g.dart';

@JsonSerializable()
class AuthTokensDto {
  const AuthTokensDto({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
  });
  
  factory AuthTokensDto.fromJson(Map<String, Object?> json) => _$AuthTokensDtoFromJson(json);
  
  /// JWT access token ngắn hạn (stateless; guard Story 2.5 verify).
  final String accessToken;

  /// Refresh token opaque — gửi tới POST /auth/refresh để lấy access token mới (rotate).
  final String refreshToken;

  /// Số giây access token còn hiệu lực.
  final num expiresIn;

  Map<String, Object?> toJson() => _$AuthTokensDtoToJson(this);
}
