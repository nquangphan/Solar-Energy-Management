// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'order_stock_issue_line_dto.dart';
import 'stock_voucher_detail_dto.dart';

part 'order_stock_issue_view_dto.g.dart';

@JsonSerializable()
class OrderStockIssueViewDto {
  const OrderStockIssueViewDto({
    required this.issued,
    required this.canIssue,
    required this.blocked,
    required this.lines,
    required this.untrackedItems,
    this.voucher,
  });
  
  factory OrderStockIssueViewDto.fromJson(Map<String, Object?> json) => _$OrderStockIssueViewDtoFromJson(json);
  
  /// The order already has its stock-out (one order, one voucher).
  final bool issued;

  /// The order stock-out — present ONLY when `issued`; not issued ⇒ the field is absent.
  final StockVoucherDetailDto? voucher;

  /// Backend-computed: not issued ∧ status allows a standalone issue (confirmed / deposit paid / in delivery / installing / acceptance) ∧ has stock-tracked lines ∧ caller holds inventory.manage.
  final bool canIssue;

  /// Backend-computed: some line has `shortfall > 0` right now (always false once issued). A warning, not the decision — the server re-checks under the lock when issuing.
  final bool blocked;

  /// Lines that will be on the voucher, in canonical order (`fieldErrors` index `lines.{i}.qty` follows it). Empty once issued.
  final List<OrderStockIssueLineDto> lines;

  /// Names of lines that are not stock-tracked (installation, fees, free-text…) — not on the voucher. Empty once issued.
  final List<String> untrackedItems;

  Map<String, Object?> toJson() => _$OrderStockIssueViewDtoToJson(this);
}
