// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'refresh_request_dto.g.dart';

@JsonSerializable()
class RefreshRequestDto {
  const RefreshRequestDto({
    required this.refreshToken,
  });
  
  factory RefreshRequestDto.fromJson(Map<String, Object?> json) => _$RefreshRequestDtoFromJson(json);
  
  /// Refresh token đã cấp lúc đăng nhập/refresh trước.
  final String refreshToken;

  Map<String, Object?> toJson() => _$RefreshRequestDtoToJson(this);
}
