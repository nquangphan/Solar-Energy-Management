// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'vat_rate_response_dto.g.dart';

@JsonSerializable()
class VatRateResponseDto {
  const VatRateResponseDto({
    required this.ratePercent,
  });
  
  factory VatRateResponseDto.fromJson(Map<String, Object?> json) => _$VatRateResponseDtoFromJson(json);
  
  /// Thuế suất VAT (%) hiệu lực — Int 0..100. Hệ thống chưa cấu hình ⇒ 8 (default từ registry, không cần seed).
  final num ratePercent;

  Map<String, Object?> toJson() => _$VatRateResponseDtoToJson(this);
}
