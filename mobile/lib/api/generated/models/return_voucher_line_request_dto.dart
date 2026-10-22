// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'return_voucher_line_request_dto.g.dart';

@JsonSerializable()
class ReturnVoucherLineRequestDto {
  const ReturnVoucherLineRequestDto({
    required this.productId,
    required this.qty,
  });
  
  factory ReturnVoucherLineRequestDto.fromJson(Map<String, Object?> json) => _$ReturnVoucherLineRequestDtoFromJson(json);
  
  /// Sản phẩm trên phiếu xuất gốc (UUID).
  final String productId;

  /// Số lượng đếm được khi nhận lại — nguyên dương, tối đa 1000000, không vượt số đã xuất. Sản phẩm không gửi = nhận lại 0.
  final num qty;

  Map<String, Object?> toJson() => _$ReturnVoucherLineRequestDtoToJson(this);
}
