// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'quote_export_file_dto.g.dart';

@JsonSerializable()
class QuoteExportFileDto {
  const QuoteExportFileDto({
    required this.fileName,
    required this.size,
  });
  
  factory QuoteExportFileDto.fromJson(Map<String, Object?> json) => _$QuoteExportFileDtoFromJson(json);
  
  /// Tên file gợi ý khi tải/share (vd `bao-gia-1a2b3c4d.png`).
  final String fileName;

  /// Kích thước file — byte.
  final num size;

  Map<String, Object?> toJson() => _$QuoteExportFileDtoToJson(this);
}
