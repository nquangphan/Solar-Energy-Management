// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'create_stock_voucher_request_dto_type.dart';
import 'stock_voucher_line_request_dto.dart';

part 'create_stock_voucher_request_dto.g.dart';

@JsonSerializable()
class CreateStockVoucherRequestDto {
  const CreateStockVoucherRequestDto({
    required this.type,
    required this.lines,
    this.note,
  });
  
  factory CreateStockVoucherRequestDto.fromJson(Map<String, Object?> json) => _$CreateStockVoucherRequestDtoFromJson(json);
  
  /// nhap = nhập kho · xuat = xuất kho không gắn đơn.
  final CreateStockVoucherRequestDtoType type;

  /// Ghi chú (vd "Tồn đầu kỳ", lý do xuất). Tối đa 500 ký tự.
  final String? note;

  /// Từ 1 đến 100 dòng; không lặp sản phẩm.
  final List<StockVoucherLineRequestDto> lines;

  Map<String, Object?> toJson() => _$CreateStockVoucherRequestDtoToJson(this);
}
