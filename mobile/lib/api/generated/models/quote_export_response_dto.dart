// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'quote_export_file_dto.dart';

part 'quote_export_response_dto.g.dart';

@JsonSerializable()
class QuoteExportResponseDto {
  const QuoteExportResponseDto({
    required this.orderId,
    required this.orderVersionId,
    required this.exportedAt,
    required this.image,
    required this.pdf,
  });
  
  factory QuoteExportResponseDto.fromJson(Map<String, Object?> json) => _$QuoteExportResponseDtoFromJson(json);
  
  /// Id Đơn.
  final String orderId;

  /// Bản hiệu lực lúc xuất — hồ sơ "xuất từ bản nào".
  final String orderVersionId;

  /// Thời điểm xuất (ISO-8601 UTC).
  final DateTime exportedAt;

  /// File ảnh PNG.
  final QuoteExportFileDto image;

  /// File PDF.
  final QuoteExportFileDto pdf;

  Map<String, Object?> toJson() => _$QuoteExportResponseDtoToJson(this);
}
