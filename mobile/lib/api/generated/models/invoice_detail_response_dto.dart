// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'invoice_line_dto.dart';
import 'invoice_pdf_response_dto.dart';
import 'invoice_seller_dto.dart';

part 'invoice_detail_response_dto.g.dart';

@JsonSerializable()
class InvoiceDetailResponseDto {
  const InvoiceDetailResponseDto({
    required this.id,
    required this.invoiceNo,
    required this.versionNo,
    required this.issuedAt,
    required this.customerName,
    required this.customerTaxCode,
    required this.vatRate,
    required this.applyVat,
    required this.subtotal,
    required this.discountAmount,
    required this.vatAmount,
    required this.total,
    required this.lineCount,
    required this.orderId,
    required this.quoteNo,
    required this.customerPhone,
    required this.customerAddress,
    required this.seller,
    required this.lines,
    required this.pdf,
  });
  
  factory InvoiceDetailResponseDto.fromJson(Map<String, Object?> json) => _$InvoiceDetailResponseDtoFromJson(json);
  
  final String id;

  /// Số hoá đơn nội bộ — `HD-{năm}-{số thứ tự ≥ 4 chữ số}`.
  final String invoiceNo;

  /// Số thứ tự bản đơn (version) được chụp lại.
  final num versionNo;

  /// Ngày lập (ISO-8601 UTC).
  final DateTime issuedAt;

  /// Tên khách chụp lúc lập.
  final String customerName;

  /// MST khách chụp lúc lập; null khi khách không có MST.
  final String? customerTaxCode;

  /// Thuế suất VAT (%) chụp lúc lập.
  final num vatRate;

  /// Có áp VAT hay không, chụp lúc lập.
  final bool applyVat;

  /// Tổng trước chiết khấu và VAT — số nguyên đồng.
  final num subtotal;

  /// Chiết khấu đã duyệt — số nguyên đồng (0 khi không có).
  final num discountAmount;

  /// Tiền VAT — số nguyên đồng (0 khi không áp VAT).
  final num vatAmount;

  /// Tổng thanh toán sau VAT — số nguyên đồng.
  final num total;

  /// Số dòng vật tư trên hoá đơn.
  final num lineCount;

  /// Đơn mà hoá đơn gắn vào.
  final String orderId;

  /// Số báo giá của đơn ("Gắn đơn") — cùng số in trên báo giá và hợp đồng.
  final String quoteNo;

  /// SĐT khách (E.164) chụp lúc lập.
  final String customerPhone;

  /// Địa chỉ khách chụp lúc lập; null khi không có.
  final String? customerAddress;
  final InvoiceSellerDto seller;

  /// Các dòng của hoá đơn theo thứ tự hiển thị.
  final List<InvoiceLineDto> lines;

  /// File PDF đã xuất; null khi chưa xuất.
  final InvoicePdfResponseDto? pdf;

  Map<String, Object?> toJson() => _$InvoiceDetailResponseDtoToJson(this);
}
