// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/dashboard_summary_response_dto.dart';
import '../models/period.dart';

part 'dashboard_client.g.dart';

@RestApi()
abstract class DashboardClient {
  factory DashboardClient(Dio dio, {String? baseUrl}) = _DashboardClient;

  /// [period] - Kỳ tính tới hôm nay (giờ Việt Nam): day = hôm nay, week = thứ Hai → hôm nay, month = ngày 1 → hôm nay. Bỏ trống ⇒ month.
  @GET('/dashboard/summary')
  Future<DashboardSummaryResponseDto> dashboardControllerSummary({
    @Query('period') Period? period = Period.month,
  });
}
