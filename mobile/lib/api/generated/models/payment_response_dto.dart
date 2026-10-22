// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'payment_response_dto_method.dart';

part 'payment_response_dto.g.dart';

@JsonSerializable()
class PaymentResponseDto {
  const PaymentResponseDto({
    required this.id,
    required this.installmentId,
    required this.amount,
    required this.paidOn,
    required this.method,
    required this.note,
    required this.recordedAt,
  });
  
  factory PaymentResponseDto.fromJson(Map<String, Object?> json) => _$PaymentResponseDtoFromJson(json);
  
  final String id;
  final String installmentId;

  /// Số tiền đã thu — số nguyên đồng.
  final num amount;
  final DateTime paidOn;
  final PaymentResponseDtoMethod method;
  final String? note;

  /// Lúc ghi nhận (ISO-8601 UTC).
  final DateTime recordedAt;

  Map<String, Object?> toJson() => _$PaymentResponseDtoToJson(this);
}
