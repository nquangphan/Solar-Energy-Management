// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'apply_discount_request_dto.g.dart';

@JsonSerializable()
class ApplyDiscountRequestDto {
  const ApplyDiscountRequestDto({
    required this.amount,
    this.note,
  });
  
  factory ApplyDiscountRequestDto.fromJson(Map<String, Object?> json) => _$ApplyDiscountRequestDtoFromJson(json);
  
  /// Mức chiết khấu — số nguyên ĐỒNG trên Đơn, tối thiểu 1; vượt subtotal hiện hành ⇒ 400.
  final num amount;

  /// Lý do đề xuất chiết khấu — optional, hiện trên màn duyệt.
  final String? note;

  Map<String, Object?> toJson() => _$ApplyDiscountRequestDtoToJson(this);
}
