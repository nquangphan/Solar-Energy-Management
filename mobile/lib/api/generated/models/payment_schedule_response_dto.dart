// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'installment_response_dto.dart';
import 'payment_schedule_response_dto_payment_status.dart';

part 'payment_schedule_response_dto.g.dart';

@JsonSerializable()
class PaymentScheduleResponseDto {
  const PaymentScheduleResponseDto({
    required this.orderId,
    required this.configured,
    required this.editable,
    required this.orderTotal,
    required this.scheduledTotal,
    required this.difference,
    required this.totalMatches,
    required this.paidTotal,
    required this.remainingTotal,
    required this.paidPercent,
    required this.paymentStatus,
    required this.recordable,
    required this.installments,
    required this.updatedAt,
  });
  
  factory PaymentScheduleResponseDto.fromJson(Map<String, Object?> json) => _$PaymentScheduleResponseDtoFromJson(json);
  
  final String orderId;

  /// false ⇒ đơn chưa có lịch (installments rỗng).
  final bool configured;

  /// Server quyết: đơn đã chốt, chưa đóng VÀ chưa có khoản thu nào thì được cấu hình lịch. Nút Sửa còn cần quyền payments.record.
  final bool editable;

  /// Tổng đơn sau VAT hiện tại — số nguyên đồng.
  final num orderTotal;

  /// Tổng các đợt — số nguyên đồng.
  final num scheduledTotal;

  /// orderTotal − scheduledTotal — số nguyên đồng, có thể âm khi các đợt vượt tổng đơn.
  final num difference;

  /// true khi tổng các đợt khớp tổng đơn sau VAT; false ⇒ hiện cảnh báo.
  final bool totalMatches;

  /// Tổng đã thu của đơn — số nguyên đồng.
  final num paidTotal;

  /// orderTotal − paidTotal — số nguyên đồng, có thể âm khi thu vượt tổng đơn.
  final num remainingTotal;

  /// Phần trăm đã thu trên tổng đơn, số nguyên làm tròn xuống; 0 khi tổng đơn bằng 0.
  final num paidPercent;

  /// paid khi đã thu đủ tổng đơn sau VAT.
  final PaymentScheduleResponseDtoPaymentStatus paymentStatus;

  /// Server quyết: trạng thái đơn cho phép ghi nhận thanh toán. Nút Ghi nhận còn cần quyền payments.record.
  final bool recordable;
  final List<InstallmentResponseDto> installments;

  /// Lần lưu lịch gần nhất (ISO-8601 UTC); null khi chưa cấu hình.
  final DateTime? updatedAt;

  Map<String, Object?> toJson() => _$PaymentScheduleResponseDtoToJson(this);
}
