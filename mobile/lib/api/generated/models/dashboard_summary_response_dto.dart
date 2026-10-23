// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'dashboard_status_count_dto.dart';
import 'dashboard_summary_response_dto_period.dart';

part 'dashboard_summary_response_dto.g.dart';

@JsonSerializable()
class DashboardSummaryResponseDto {
  const DashboardSummaryResponseDto({
    required this.period,
    required this.from,
    required this.to,
    required this.revenue,
    required this.newOrderCount,
    required this.ordersByStatus,
  });
  
  factory DashboardSummaryResponseDto.fromJson(Map<String, Object?> json) => _$DashboardSummaryResponseDtoFromJson(json);
  
  final DashboardSummaryResponseDtoPeriod period;

  /// Ngày đầu kỳ (giờ Việt Nam), YYYY-MM-DD, tính cả ngày này.
  final String from;

  /// Ngày cuối kỳ = hôm nay (giờ Việt Nam), YYYY-MM-DD, tính cả ngày này.
  final String to;

  /// Tổng tiền đã thu trong kỳ (theo ngày thu) của toàn công ty — số nguyên đồng. null khi thiếu quyền dashboard.finance_view.
  final int? revenue;

  /// Số đơn tạo trong kỳ, trong phạm vi xem đơn của người gọi. null khi thiếu cả orders.view_all lẫn orders.view_own.
  final int? newOrderCount;

  /// Số đơn hiện tại theo từng trạng thái (không lọc theo kỳ), đủ mọi trạng thái theo thứ tự quy trình, trong phạm vi xem đơn của người gọi. null khi thiếu cả orders.view_all lẫn orders.view_own.
  final List<DashboardStatusCountDto>? ordersByStatus;

  Map<String, Object?> toJson() => _$DashboardSummaryResponseDtoToJson(this);
}
