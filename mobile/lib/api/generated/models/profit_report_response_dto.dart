// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'profit_figures_dto.dart';
import 'profit_group_by.dart';
import 'profit_report_row_dto.dart';

part 'profit_report_response_dto.g.dart';

@JsonSerializable()
class ProfitReportResponseDto {
  const ProfitReportResponseDto({
    required this.groupBy,
    required this.from,
    required this.to,
    required this.totals,
    required this.rows,
  });
  
  factory ProfitReportResponseDto.fromJson(Map<String, Object?> json) => _$ProfitReportResponseDtoFromJson(json);
  
  final ProfitGroupBy groupBy;

  /// Ngày đầu kỳ (giờ Việt Nam), YYYY-MM-DD, tính cả ngày này.
  final String from;

  /// Ngày cuối kỳ (giờ Việt Nam), YYYY-MM-DD, tính cả ngày này.
  final String to;
  final ProfitFiguresDto totals;
  final List<ProfitReportRowDto> rows;

  Map<String, Object?> toJson() => _$ProfitReportResponseDtoToJson(this);
}
