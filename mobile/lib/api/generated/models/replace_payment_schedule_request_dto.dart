// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'installment_input_dto.dart';

part 'replace_payment_schedule_request_dto.g.dart';

@JsonSerializable()
class ReplacePaymentScheduleRequestDto {
  const ReplacePaymentScheduleRequestDto({
    required this.installments,
  });
  
  factory ReplacePaymentScheduleRequestDto.fromJson(Map<String, Object?> json) => _$ReplacePaymentScheduleRequestDtoFromJson(json);
  
  /// Các đợt theo thứ tự thu, từ 1 đến 12 đợt. Đợt 1 là cọc; mốc tự động do server gán theo vị trí.
  final List<InstallmentInputDto> installments;

  Map<String, Object?> toJson() => _$ReplacePaymentScheduleRequestDtoToJson(this);
}
