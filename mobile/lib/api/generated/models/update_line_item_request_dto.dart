// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'update_line_item_request_dto.g.dart';

@JsonSerializable()
class UpdateLineItemRequestDto {
  const UpdateLineItemRequestDto({
    this.qty,
    this.unitPrice,
    this.note,
    this.isFlexible,
    this.warrantyMonths,
  });
  
  factory UpdateLineItemRequestDto.fromJson(Map<String, Object?> json) => _$UpdateLineItemRequestDtoFromJson(json);
  
  /// Số lượng — nguyên, tối thiểu 1.
  final num? qty;

  /// Đơn giá — số nguyên ĐỒNG. CHỈ dòng priceEditable = true (ngược lại 400).
  final num? unitPrice;

  /// Diễn giải — gửi `null` để xoá.
  final String? note;

  /// Cờ "linh động/dự kiến" — chỉ hiển thị.
  final bool? isFlexible;

  /// Bảo hành (tháng) — nguyên ≥ 1; gửi `null` để bỏ bảo hành (giá trị nghiệp vụ hợp lệ). Dòng catalog priceEditable = true (công lắp/phí lắp đặt): field bị bỏ qua im lặng, luôn giữ null.
  final num? warrantyMonths;

  Map<String, Object?> toJson() => _$UpdateLineItemRequestDtoToJson(this);
}
