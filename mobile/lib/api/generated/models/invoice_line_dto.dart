// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'invoice_line_dto.g.dart';

@JsonSerializable()
class InvoiceLineDto {
  const InvoiceLineDto({
    required this.displayOrder,
    required this.name,
    required this.unit,
    required this.qty,
    required this.unitPrice,
    required this.amount,
  });
  
  factory InvoiceLineDto.fromJson(Map<String, Object?> json) => _$InvoiceLineDtoFromJson(json);
  
  /// Thứ tự dòng trên hoá đơn (tăng dần).
  final num displayOrder;
  final String name;
  final String unit;

  /// Số lượng.
  final num qty;

  /// Đơn giá — số nguyên đồng.
  final num unitPrice;

  /// Thành tiền — số nguyên đồng.
  final num amount;

  Map<String, Object?> toJson() => _$InvoiceLineDtoToJson(this);
}
