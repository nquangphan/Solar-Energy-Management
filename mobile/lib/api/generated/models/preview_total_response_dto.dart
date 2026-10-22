// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'preview_total_response_dto.g.dart';

@JsonSerializable()
class PreviewTotalResponseDto {
  const PreviewTotalResponseDto({
    required this.subtotal,
    required this.discountAmount,
    required this.vatAmount,
    required this.total,
    required this.vatRate,
    required this.applyVat,
  });
  
  factory PreviewTotalResponseDto.fromJson(Map<String, Object?> json) => _$PreviewTotalResponseDtoFromJson(json);
  
  /// Tổng trước VAT — integer đồng.
  final num subtotal;

  /// Chiết khấu ĐÃ ÁP cho lần tính này — echo từ request (0 khi vắng); VAT tính trên subtotal − discountAmount (Story 4.7).
  final num discountAmount;

  /// Tiền VAT — integer đồng, round-half-up một điểm.
  final num vatAmount;

  /// Tổng sau VAT — integer đồng.
  final num total;

  /// Thuế suất (%) ĐÃ ÁP cho lần tính này — backend resolve từ config hệ thống, client chỉ hiển thị nhãn (vd "VAT 8%").
  final num vatRate;

  /// Lần tính này có áp VAT không — theo vatMode client echo (vắng/co_vat ⇒ true).
  final bool applyVat;

  Map<String, Object?> toJson() => _$PreviewTotalResponseDtoToJson(this);
}
