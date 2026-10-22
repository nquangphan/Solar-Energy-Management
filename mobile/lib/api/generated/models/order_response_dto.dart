// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'order_discount_dto.dart';
import 'order_line_item_response_dto.dart';
import 'order_response_dto_vat_mode.dart';

part 'order_response_dto.g.dart';

@JsonSerializable()
class OrderResponseDto {
  const OrderResponseDto({
    required this.id,
    required this.status,
    required this.customerPhone,
    required this.ownerAccountId,
    required this.sourceId,
    required this.custType,
    required this.scopeEquipment,
    required this.scopeConstruction,
    required this.scopeDelivery,
    required this.lineItems,
    required this.createdAt,
    required this.updatedAt,
    this.currentVersionId,
    this.assigneeAccountId,
    this.kWp,
    this.vatMode,
    this.validityNote,
    this.cancelReason,
    this.cancelledAt,
    this.discount,
  });
  
  factory OrderResponseDto.fromJson(Map<String, Object?> json) => _$OrderResponseDtoFromJson(json);
  
  final String id;

  /// Trạng thái đơn — đơn mới luôn 'baogia'; mọi thay đổi đi qua applyTransition().
  final String status;

  /// SĐT khách (E.164) — FK về Customer.
  final String customerPhone;

  /// Con trỏ bản hiệu lực (AD-6) — luôn có sau khi tạo xong.
  final String? currentVersionId;

  /// Người tạo/phụ trách (AD-15) — actor lúc tạo.
  final String ownerAccountId;
  final String? assigneeAccountId;

  /// SNAPSHOT nguồn khách LÚC TẠO đơn (FR-35) — copy từ Customer.sourceId, không đổi theo khách.
  final String sourceId;

  /// Loại khách — nhãn báo cáo, copy từ Customer lúc tạo.
  final String custType;

  /// Phạm vi: thiết bị. Hành vi preset thuộc Story 4.3.
  final bool scopeEquipment;

  /// Phạm vi: thi công. Hành vi preset thuộc Story 4.3.
  final bool scopeConstruction;

  /// Phạm vi: vận chuyển. Hành vi preset thuộc Story 4.3.
  final bool scopeDelivery;

  /// Công suất hệ (kWp) — Float tối đa 2 chữ số lẻ (vd 8.82), nhập qua PATCH (Story 4.4). null = chưa nhập.
  final num? kWp;

  /// Tick áp VAT: 'co_vat' | 'khong_vat' — đơn mới luôn 'co_vat'; null chỉ ở đơn tạo trước 4.4 (tính như có VAT).
  final OrderResponseDtoVatMode? vatMode;

  /// Hạn hiệu lực báo giá — chuỗi tự do ≤ 200 ký tự, Phase 1 chỉ hiển thị (Story 4.4). null = chưa nhập.
  final String? validityNote;

  /// Lý do huỷ đơn (Story 5.7) — null khi đơn chưa huỷ. KHÔNG rào theo quyền: ai xem được đơn thì xem được lý do huỷ của nó.
  final String? cancelReason;

  /// Thời điểm huỷ (ISO-8601 UTC) — CÙNG một giá trị với `occurredAt` của hàng audit huỷ. null khi đơn chưa huỷ.
  final DateTime? cancelledAt;

  /// Dòng của BẢN HIỆU LỰC (qua currentVersionId), sắp theo displayOrder tăng dần. Rỗng = đơn mới tạo.
  final List<OrderLineItemResponseDto> lineItems;

  /// Trạng thái chiết khấu — approval MỚI NHẤT (Story 4.7); null = đơn chưa từng áp chiết khấu.
  final OrderDiscountDto? discount;
  final DateTime createdAt;
  final DateTime updatedAt;

  Map<String, Object?> toJson() => _$OrderResponseDtoToJson(this);
}
