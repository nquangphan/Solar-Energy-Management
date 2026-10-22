// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'qty_change_dto.dart';

part 'version_changes_dto.g.dart';

@JsonSerializable()
class VersionChangesDto {
  const VersionChangesDto({
    required this.added,
    required this.removed,
    required this.qtyChanged,
  });
  
  factory VersionChangesDto.fromJson(Map<String, Object?> json) => _$VersionChangesDtoFromJson(json);
  
  /// Tên các dòng mới thêm.
  final List<String> added;

  /// Tên các dòng bị xoá.
  final List<String> removed;
  final List<QtyChangeDto> qtyChanged;

  Map<String, Object?> toJson() => _$VersionChangesDtoToJson(this);
}
