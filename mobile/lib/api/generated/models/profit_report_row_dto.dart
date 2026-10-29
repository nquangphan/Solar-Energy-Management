// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'profit_report_row_dto.g.dart';

@JsonSerializable()
class ProfitReportRowDto {
  const ProfitReportRowDto({
    required this.revenue,
    required this.cost,
    required this.grossProfit,
    required this.marginPct,
    required this.orderCount,
    required this.key,
    required this.label,
    required this.customerName,
    required this.assigneeDisplayName,
    required this.sourceName,
    required this.issuedAt,
  });
  
  factory ProfitReportRowDto.fromJson(Map<String, Object?> json) => _$ProfitReportRowDtoFromJson(json);
  
  /// Doanh thu = Σ(giá bán chốt × số lượng) − chiết khấu đã duyệt, trước VAT — số nguyên đồng.
  final int revenue;

  /// Giá vốn = Σ(giá vốn đóng băng lúc xuất kho × số lượng) — số nguyên đồng.
  final int cost;

  /// Lợi nhuận gộp = doanh thu − giá vốn — số nguyên đồng.
  final int grossProfit;

  /// Biên lợi nhuận gộp, phần trăm nguyên làm tròn nửa lên (có thể âm); null khi doanh thu ≤ 0.
  final int? marginPct;

  /// Số đơn đã xuất kho được tính.
  final int orderCount;

  /// Khoá nhóm: mã đơn | YYYY-MM | mã account người phụ trách (null = đơn chưa giao) | mã nguồn khách.
  final String? key;

  /// Nhãn hàng do server dựng: số báo giá BG-XXXXXXXX | MM/YYYY | tên người phụ trách hoặc "Chưa giao người phụ trách" | tên nguồn khách.
  final String label;

  /// Tên khách — chỉ khi nhóm theo đơn, cách nhóm khác null.
  final String? customerName;

  /// Tên người phụ trách — chỉ khi nhóm theo đơn; null khi đơn chưa giao hoặc cách nhóm khác.
  final String? assigneeDisplayName;

  /// Tên nguồn khách — chỉ khi nhóm theo đơn, cách nhóm khác null.
  final String? sourceName;

  /// Thời điểm xuất kho (ISO-8601 UTC) — chỉ khi nhóm theo đơn, cách nhóm khác null.
  final DateTime? issuedAt;

  Map<String, Object?> toJson() => _$ProfitReportRowDtoToJson(this);
}
