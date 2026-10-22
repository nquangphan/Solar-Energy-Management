// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'preview_total_line_dto.g.dart';

@JsonSerializable()
class PreviewTotalLineDto {
  const PreviewTotalLineDto({
    required this.unitPrice,
    required this.qty,
  });
  
  factory PreviewTotalLineDto.fromJson(Map<String, Object?> json) => _$PreviewTotalLineDtoFromJson(json);
  
  /// Đơn giá — số nguyên ĐỒNG, echo từ số backend đã trả.
  final num unitPrice;

  /// Số lượng — nguyên, tối thiểu 1.
  final num qty;

  Map<String, Object?> toJson() => _$PreviewTotalLineDtoToJson(this);
}
