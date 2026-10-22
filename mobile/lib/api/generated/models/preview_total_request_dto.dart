// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'preview_total_line_dto.dart';
import 'preview_total_request_dto_vat_mode.dart';

part 'preview_total_request_dto.g.dart';

@JsonSerializable()
class PreviewTotalRequestDto {
  const PreviewTotalRequestDto({
    required this.lines,
    this.vatMode,
    this.discountAmount,
  });
  
  factory PreviewTotalRequestDto.fromJson(Map<String, Object?> json) => _$PreviewTotalRequestDtoFromJson(json);
  
  /// Các dòng giỏ hàng đang hiển thị. Mảng RỖNG hợp lệ (giỏ vừa xoá sạch ⇒ tổng 0). Tối đa 500 dòng.
  final List<PreviewTotalLineDto> lines;

  /// Tick áp VAT — client ECHO từ `Order.vatMode` (như đã echo unitPrice), KHÔNG BAO GIỜ gửi rate. Vắng field = đơn cũ vatMode null ⇒ tính như có VAT.
  final PreviewTotalRequestDtoVatMode? vatMode;

  /// Chiết khấu — client ECHO từ `Order.discount.amount` (Story 4.7), KHÔNG tự tính. Int ≥ 0; vượt subtotal ⇒ 400. Vắng field = không chiết khấu.
  final num? discountAmount;

  Map<String, Object?> toJson() => _$PreviewTotalRequestDtoToJson(this);
}
