// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'stock_voucher_summary_dto.dart';

part 'stock_voucher_list_response_dto.g.dart';

@JsonSerializable()
class StockVoucherListResponseDto {
  const StockVoucherListResponseDto({
    required this.items,
  });
  
  factory StockVoucherListResponseDto.fromJson(Map<String, Object?> json) => _$StockVoucherListResponseDtoFromJson(json);
  
  /// Mới nhất trước; tối đa 100 phiếu.
  final List<StockVoucherSummaryDto> items;

  Map<String, Object?> toJson() => _$StockVoucherListResponseDtoToJson(this);
}
