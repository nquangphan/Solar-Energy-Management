// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/audit_log_list_response_dto.dart';
import '../models/audit_target_type.dart';

part 'audit_client.g.dart';

@RestApi()
abstract class AuditClient {
  factory AuditClient(Dio dio, {String? baseUrl}) = _AuditClient;

  /// [targetType] - Lọc theo loại đối tượng. Bỏ trống ⇒ mọi loại.
  ///
  /// [from] - Từ ngày YYYY-MM-DD (giờ Việt Nam, tính cả ngày này).
  ///
  /// [to] - Đến ngày YYYY-MM-DD (giờ Việt Nam, tính cả ngày này).
  ///
  /// [page] - Trang, bắt đầu từ 1.
  ///
  /// [pageSize] - Số bản ghi mỗi trang — tối đa 100.
  @GET('/audit-logs')
  Future<AuditLogListResponseDto> auditControllerList({
    @Query('page') num? page = 1,
    @Query('pageSize') num? pageSize = 20,
    @Query('targetType') AuditTargetType? targetType,
    @Query('from') String? from,
    @Query('to') String? to,
  });
}
