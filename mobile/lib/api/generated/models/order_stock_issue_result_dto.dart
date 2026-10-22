// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'stock_voucher_detail_dto.dart';

part 'order_stock_issue_result_dto.g.dart';

@JsonSerializable()
class OrderStockIssueResultDto {
  const OrderStockIssueResultDto({
    required this.voucher,
  });
  
  factory OrderStockIssueResultDto.fromJson(Map<String, Object?> json) => _$OrderStockIssueResultDtoFromJson(json);
  
  /// The order stock-out — just created (201) or already existing (200). `lines[].unitCost` only with costs.view.
  final StockVoucherDetailDto voucher;

  Map<String, Object?> toJson() => _$OrderStockIssueResultDtoToJson(this);
}
