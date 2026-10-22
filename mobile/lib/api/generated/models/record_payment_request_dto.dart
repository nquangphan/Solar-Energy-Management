// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'record_payment_request_dto_method.dart';

part 'record_payment_request_dto.g.dart';

@JsonSerializable()
class RecordPaymentRequestDto {
  const RecordPaymentRequestDto({
    required this.idempotencyKey,
    required this.installmentId,
    required this.amount,
    required this.paidOn,
    required this.method,
    this.note,
  });
  
  factory RecordPaymentRequestDto.fromJson(Map<String, Object?> json) => _$RecordPaymentRequestDtoFromJson(json);
  
  /// Khoá chống ghi trùng do client sinh MỘT lần cho mỗi lần mở form; retry phải gửi lại đúng khoá.
  final String idempotencyKey;

  /// id của đợt (không phải seq) — lịch bị thay giữa lúc xem và lúc ghi ⇒ 409 thay vì ghi nhầm đợt.
  final String installmentId;

  /// Số tiền thu — số nguyên đồng, 1..2000000000, không vượt phần còn lại của đợt.
  final num amount;

  /// Ngày thu YYYY-MM-DD, không sau hôm nay (giờ Việt Nam).
  final String paidOn;
  final RecordPaymentRequestDtoMethod method;

  /// Ghi chú, tối đa 200 ký tự sau khi bỏ khoảng trắng hai đầu.
  final String? note;

  Map<String, Object?> toJson() => _$RecordPaymentRequestDtoToJson(this);
}
