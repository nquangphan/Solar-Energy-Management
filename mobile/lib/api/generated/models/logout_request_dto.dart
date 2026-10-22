// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'logout_request_dto.g.dart';

@JsonSerializable()
class LogoutRequestDto {
  const LogoutRequestDto({
    required this.refreshToken,
  });
  
  factory LogoutRequestDto.fromJson(Map<String, Object?> json) => _$LogoutRequestDtoFromJson(json);
  
  /// Refresh token của phiên cần thu hồi.
  final String refreshToken;

  Map<String, Object?> toJson() => _$LogoutRequestDtoToJson(this);
}
