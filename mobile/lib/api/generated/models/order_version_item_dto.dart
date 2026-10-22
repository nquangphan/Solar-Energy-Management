// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'version_changes_dto.dart';

part 'order_version_item_dto.g.dart';

@JsonSerializable()
class OrderVersionItemDto {
  const OrderVersionItemDto({
    required this.id,
    required this.versionNo,
    required this.isCurrent,
    required this.createdAt,
    required this.lineCount,
    required this.changes,
    this.confirmedAt,
    this.createdByAccountId,
    this.createdByDisplayName,
  });
  
  factory OrderVersionItemDto.fromJson(Map<String, Object?> json) => _$OrderVersionItemDtoFromJson(json);
  
  final String id;

  /// Số thứ tự bản, bắt đầu từ 1.
  final num versionNo;

  /// Bản đang hiệu lực (theo currentVersionId).
  final bool isCurrent;

  /// ISO-8601 UTC.
  final DateTime createdAt;

  /// Thời điểm bản này được Chốt; null nếu chưa chốt.
  final DateTime? confirmedAt;
  final String? createdByAccountId;

  /// Tên hiển thị người tạo bản; null với bản cũ không có actor.
  final String? createdByDisplayName;

  /// Số dòng của chính bản này.
  final num lineCount;
  final VersionChangesDto changes;

  Map<String, Object?> toJson() => _$OrderVersionItemDtoToJson(this);
}
