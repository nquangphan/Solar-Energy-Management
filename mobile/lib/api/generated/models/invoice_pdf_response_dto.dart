// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'invoice_pdf_response_dto.g.dart';

@JsonSerializable()
class InvoicePdfResponseDto {
  const InvoicePdfResponseDto({
    required this.fileName,
    required this.pdfSize,
    required this.exportedAt,
  });
  
  factory InvoicePdfResponseDto.fromJson(Map<String, Object?> json) => _$InvoicePdfResponseDtoFromJson(json);
  
  /// Tên file tải về (ASCII, có đuôi .pdf).
  final String fileName;

  /// Kích thước file — byte.
  final num pdfSize;

  /// Lúc xuất PDF lần đầu (ISO-8601 UTC).
  final DateTime exportedAt;

  Map<String, Object?> toJson() => _$InvoicePdfResponseDtoToJson(this);
}
