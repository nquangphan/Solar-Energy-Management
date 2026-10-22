// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'update_order_request_dto_vat_mode.dart';

part 'update_order_request_dto.g.dart';

@JsonSerializable()
class UpdateOrderRequestDto {
  const UpdateOrderRequestDto({
    this.scopeConstruction,
    this.scopeDelivery,
    this.vatMode,
    this.kWp,
    this.validityNote,
  });
  
  factory UpdateOrderRequestDto.fromJson(Map<String, Object?> json) => _$UpdateOrderRequestDtoFromJson(json);
  
  /// Cờ phạm vi Thi công — chỉ đổi được khi đơn còn ở baogia.
  final bool? scopeConstruction;

  /// Cờ phạm vi Vận chuyển — chỉ đổi được khi đơn còn ở baogia.
  final bool? scopeDelivery;

  /// Tick áp VAT (FR-3): 'co_vat' | 'khong_vat' — chỉ đổi được khi đơn còn ở baogia (4.5 snapshot lúc Chốt).
  final UpdateOrderRequestDtoVatMode? vatMode;

  /// Công suất hệ (kWp) — số > 0, tối đa 2 chữ số lẻ (vd 8.82). Gửi null để xoá.
  final num? kWp;

  /// Hạn hiệu lực báo giá — chuỗi tự do ≤ 200 ký tự (vd "48h kể từ ngày lên PO"), Phase 1 chỉ hiển thị. Gửi null để xoá.
  final String? validityNote;

  Map<String, Object?> toJson() => _$UpdateOrderRequestDtoToJson(this);
}
