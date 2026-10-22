// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'installment_input_dto.g.dart';

@JsonSerializable()
class InstallmentInputDto {
  const InstallmentInputDto({
    required this.conditionNote,
    this.percent,
    this.amount,
  });
  
  factory InstallmentInputDto.fromJson(Map<String, Object?> json) => _$InstallmentInputDtoFromJson(json);
  
  /// Phần trăm của tổng đơn sau VAT, số nguyên 1..100. Gửi ĐÚNG MỘT trong `percent`/`amount`.
  final num? percent;

  /// Số tiền của đợt — số nguyên đồng, 1..2000000000. Gửi ĐÚNG MỘT trong `percent`/`amount`.
  final num? amount;

  /// Mô tả điều kiện thu (vd "Cọc khi ký hợp đồng"), 1..200 ký tự sau khi bỏ khoảng trắng hai đầu.
  final String conditionNote;

  Map<String, Object?> toJson() => _$InstallmentInputDtoToJson(this);
}
