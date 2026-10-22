// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'discount_pending_line_dto.dart';

part 'discount_pending_item_dto.g.dart';

@JsonSerializable()
class DiscountPendingItemDto {
  const DiscountPendingItemDto({
    required this.orderId,
    required this.customerPhone,
    required this.amount,
    required this.requestedByAccountId,
    required this.requestedByDisplayName,
    required this.requestedAt,
    required this.subtotal,
    required this.afterDiscount,
    required this.lines,
    this.requestNote,
  });
  
  factory DiscountPendingItemDto.fromJson(Map<String, Object?> json) => _$DiscountPendingItemDtoFromJson(json);
  
  /// Id đơn hàng chờ duyệt chiết khấu.
  final String orderId;

  /// SĐT khách (E.164).
  final String customerPhone;

  /// Mức chiết khấu đề xuất — integer đồng.
  final num amount;

  /// Lý do đề xuất — nullable.
  final String? requestNote;

  /// Id người đề xuất.
  final String requestedByAccountId;

  /// Tên hiển thị người đề xuất.
  final String requestedByDisplayName;

  /// Thời điểm gửi duyệt.
  final DateTime requestedAt;

  /// Giá gốc (tổng tiền hàng trước chiết khấu) — backend tính.
  final num subtotal;

  /// Sau chiết khấu (subtotal − amount) — backend tính.
  final num afterDiscount;

  /// Dòng của bản hiệu lực kèm biên ước tính per-line.
  final List<DiscountPendingLineDto> lines;

  Map<String, Object?> toJson() => _$DiscountPendingItemDtoToJson(this);
}
