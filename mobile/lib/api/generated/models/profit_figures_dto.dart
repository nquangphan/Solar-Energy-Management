// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'profit_figures_dto.g.dart';

@JsonSerializable()
class ProfitFiguresDto {
  const ProfitFiguresDto({
    required this.revenue,
    required this.cost,
    required this.grossProfit,
    required this.marginPct,
    required this.orderCount,
  });
  
  factory ProfitFiguresDto.fromJson(Map<String, Object?> json) => _$ProfitFiguresDtoFromJson(json);
  
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

  Map<String, Object?> toJson() => _$ProfitFiguresDtoToJson(this);
}
