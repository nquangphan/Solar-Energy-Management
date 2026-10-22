// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/company_legal_entity_dto.dart';
import '../models/update_vat_rate_request_dto.dart';
import '../models/vat_rate_response_dto.dart';

part 'settings_client.g.dart';

@RestApi()
abstract class SettingsClient {
  factory SettingsClient(Dio dio, {String? baseUrl}) = _SettingsClient;

  @GET('/settings/vat-rate')
  Future<VatRateResponseDto> settingsControllerGetVatRate();

  @PATCH('/settings/vat-rate')
  Future<VatRateResponseDto> settingsControllerUpdateVatRate({
    @Body() required UpdateVatRateRequestDto body,
  });

  @GET('/settings/company-legal-entity')
  Future<CompanyLegalEntityDto> settingsControllerGetCompanyLegalEntity();

  @PUT('/settings/company-legal-entity')
  Future<CompanyLegalEntityDto> settingsControllerUpdateCompanyLegalEntity({
    @Body() required CompanyLegalEntityDto body,
  });
}
