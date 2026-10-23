// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'update_account_permissions_request_dto.g.dart';

@JsonSerializable()
class UpdateAccountPermissionsRequestDto {
  const UpdateAccountPermissionsRequestDto({
    required this.permissions,
  });
  
  factory UpdateAccountPermissionsRequestDto.fromJson(Map<String, Object?> json) => _$UpdateAccountPermissionsRequestDtoFromJson(json);
  
  /// Bộ quyền MỚI, thay thế toàn bộ bộ cũ.
  final List<String> permissions;

  Map<String, Object?> toJson() => _$UpdateAccountPermissionsRequestDtoToJson(this);
}
