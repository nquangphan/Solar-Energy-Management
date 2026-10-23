// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/account_permission_summary_dto.dart';
import '../models/create_account_request_dto.dart';
import '../models/permission_options_response_dto.dart';
import '../models/update_account_permissions_request_dto.dart';
import '../models/update_account_request_dto.dart';

part 'accounts_client.g.dart';

@RestApi()
abstract class AccountsClient {
  factory AccountsClient(Dio dio, {String? baseUrl}) = _AccountsClient;

  @GET('/accounts')
  Future<List<AccountPermissionSummaryDto>> accountsControllerList();

  @POST('/accounts')
  Future<AccountPermissionSummaryDto> accountsControllerCreate({
    @Body() required CreateAccountRequestDto body,
  });

  @GET('/accounts/permission-options')
  Future<PermissionOptionsResponseDto> accountsControllerPermissionOptions();

  @PUT('/accounts/{id}/permissions')
  Future<AccountPermissionSummaryDto> accountsControllerUpdatePermissions({
    @Path('id') required String id,
    @Body() required UpdateAccountPermissionsRequestDto body,
  });

  @PUT('/accounts/{id}')
  Future<AccountPermissionSummaryDto> accountsControllerUpdate({
    @Path('id') required String id,
    @Body() required UpdateAccountRequestDto body,
  });
}
