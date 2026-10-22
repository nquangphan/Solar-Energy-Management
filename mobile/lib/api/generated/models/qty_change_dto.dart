// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'qty_change_dto.g.dart';

@JsonSerializable()
class QtyChangeDto {
  const QtyChangeDto({
    required this.name,
    required this.from,
    required this.to,
  });
  
  factory QtyChangeDto.fromJson(Map<String, Object?> json) => _$QtyChangeDtoFromJson(json);
  
  /// Tên dòng ở bản mới.
  final String name;

  /// Số lượng ở bản trước.
  final num from;

  /// Số lượng ở bản này.
  final num to;

  Map<String, Object?> toJson() => _$QtyChangeDtoToJson(this);
}
