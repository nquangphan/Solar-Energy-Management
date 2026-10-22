// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'update_vat_rate_request_dto.g.dart';

@JsonSerializable()
class UpdateVatRateRequestDto {
  const UpdateVatRateRequestDto({
    required this.ratePercent,
  });
  
  factory UpdateVatRateRequestDto.fromJson(Map<String, Object?> json) => _$UpdateVatRateRequestDtoFromJson(json);
  
  /// Thuế suất VAT mới (%) — Int 0..100.
  final num ratePercent;

  Map<String, Object?> toJson() => _$UpdateVatRateRequestDtoToJson(this);
}
