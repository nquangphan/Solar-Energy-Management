// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'invoice_response_dto.dart';

part 'invoices_overview_response_dto.g.dart';

@JsonSerializable()
class InvoicesOverviewResponseDto {
  const InvoicesOverviewResponseDto({
    required this.creatable,
    required this.blockedReason,
    required this.currentInvoiceId,
    required this.versionNo,
    required this.customerName,
    required this.customerTaxCode,
    required this.lineCount,
    required this.orderTotal,
    required this.invoices,
  });
  
  factory InvoicesOverviewResponseDto.fromJson(Map<String, Object?> json) => _$InvoicesOverviewResponseDtoFromJson(json);
  
  /// true ⇒ POST sẽ tạo hoá đơn mới; false ⇒ blockedReason nói vì sao, hoặc bản hiện hành đã có hoá đơn (currentInvoiceId).
  final bool creatable;

  /// Lý do không tạo được (tiếng Việt, cùng message POST trả); null khi tạo được hoặc khi lý do duy nhất là bản hiện hành đã có hoá đơn.
  final String? blockedReason;

  /// Hoá đơn của bản đơn hiện hành, nếu đã lập.
  final String? currentInvoiceId;

  /// Số thứ tự bản đơn hiện hành (0 khi chưa có bản).
  final num versionNo;
  final String customerName;

  /// MST khách hiện tại; null khi khách không có MST.
  final String? customerTaxCode;

  /// Số dòng vật tư của bản hiện hành.
  final num lineCount;

  /// Tổng đơn sau VAT sẽ ghi vào hoá đơn — số nguyên đồng.
  final num orderTotal;

  /// Hoá đơn đã tạo của đơn, mới nhất trước.
  final List<InvoiceResponseDto> invoices;

  Map<String, Object?> toJson() => _$InvoicesOverviewResponseDtoToJson(this);
}
