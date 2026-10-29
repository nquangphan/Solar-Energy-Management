// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'permission_transition_dto.g.dart';

@JsonSerializable()
class PermissionTransitionDto {
  const PermissionTransitionDto({
    required this.event,
    required this.from,
    required this.to,
  });
  
  factory PermissionTransitionDto.fromJson(Map<String, Object?> json) => _$PermissionTransitionDtoFromJson(json);
  
  final String event;
  final String from;
  final String to;

  Map<String, Object?> toJson() => _$PermissionTransitionDtoToJson(this);
}
