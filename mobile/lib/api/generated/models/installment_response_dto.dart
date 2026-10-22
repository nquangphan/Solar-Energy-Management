// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'installment_response_dto_milestone.dart';
import 'installment_response_dto_status.dart';
import 'payment_response_dto.dart';

part 'installment_response_dto.g.dart';

@JsonSerializable()
class InstallmentResponseDto {
  const InstallmentResponseDto({
    required this.id,
    required this.seq,
    required this.percent,
    required this.amount,
    required this.conditionNote,
    required this.milestone,
    required this.paidAmount,
    required this.remainingAmount,
    required this.status,
    required this.payments,
  });
  
  factory InstallmentResponseDto.fromJson(Map<String, Object?> json) => _$InstallmentResponseDtoFromJson(json);
  
  /// id của đợt — gửi kèm khi ghi nhận thanh toán.
  final String id;

  /// Thứ tự đợt, bắt đầu từ 1.
  final num seq;

  /// Phần trăm người dùng nhập; null nếu đợt nhập theo số tiền.
  final num? percent;

  /// Số tiền của đợt — số nguyên đồng, server phân giải lúc lưu.
  final num amount;
  final String conditionNote;

  /// Mốc tự động do server gán theo vị trí: đợt 1 = coc, đợt cuối (khi ≥ 2 đợt) = tat_toan, còn lại null.
  final InstallmentResponseDtoMilestone? milestone;

  /// Đã thu cho đợt này — số nguyên đồng.
  final num paidAmount;

  /// Còn phải thu của đợt (amount − paidAmount, không âm) — số nguyên đồng.
  final num remainingAmount;
  final InstallmentResponseDtoStatus status;

  /// Các khoản đã thu của đợt, theo ngày thu rồi lúc ghi tăng dần.
  final List<PaymentResponseDto> payments;

  Map<String, Object?> toJson() => _$InstallmentResponseDtoToJson(this);
}
