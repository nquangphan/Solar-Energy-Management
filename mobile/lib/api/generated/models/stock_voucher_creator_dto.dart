// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'stock_voucher_creator_dto.g.dart';

@JsonSerializable()
class StockVoucherCreatorDto {
  const StockVoucherCreatorDto({
    required this.id,
    required this.displayName,
  });
  
  factory StockVoucherCreatorDto.fromJson(Map<String, Object?> json) => _$StockVoucherCreatorDtoFromJson(json);
  
  final String id;
  final String displayName;

  Map<String, Object?> toJson() => _$StockVoucherCreatorDtoToJson(this);
}
