// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/profit_group_by.dart';
import '../models/profit_period.dart';
import '../models/profit_report_response_dto.dart';

part 'reports_client.g.dart';

@RestApi()
abstract class ReportsClient {
  factory ReportsClient(Dio dio, {String? baseUrl}) = _ReportsClient;

  /// [groupBy] - Cách nhóm: order = mỗi đơn một hàng, month = theo tháng xuất kho, assignee = theo người phụ trách, source = theo nguồn khách. Bỏ trống ⇒ order.
  ///
  /// [period] - Kỳ theo ngày xuất kho (giờ Việt Nam): month = ngày 1 → hôm nay, year = 01/01 → hôm nay, custom = from → to. Bỏ trống ⇒ month.
  ///
  /// [from] - Từ ngày YYYY-MM-DD (giờ Việt Nam, tính cả ngày này). Bắt buộc khi period=custom, cấm gửi với kỳ khác.
  ///
  /// [to] - Đến ngày YYYY-MM-DD (giờ Việt Nam, tính cả ngày này). Bắt buộc khi period=custom, cấm gửi với kỳ khác.
  @GET('/reports/profit')
  Future<ProfitReportResponseDto> profitReportControllerProfit({
    @Query('groupBy') ProfitGroupBy? groupBy,
    @Query('period') ProfitPeriod? period,
    @Query('from') String? from,
    @Query('to') String? to,
  });
}
