// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/contract_response_dto.dart';
import '../models/contracts_overview_response_dto.dart';

part 'contracts_client.g.dart';

@RestApi()
abstract class ContractsClient {
  factory ContractsClient(Dio dio, {String? baseUrl}) = _ContractsClient;

  @GET('/orders/{id}/contracts')
  Future<ContractsOverviewResponseDto> contractsControllerOverview({
    @Path('id') required String id,
  });

  @POST('/orders/{id}/contracts')
  Future<ContractResponseDto> contractsControllerGenerate({
    @Path('id') required String id,
  });

  @GET('/orders/{id}/contracts/{contractId}/pdf')
  @DioResponseType(ResponseType.stream)
  Stream<Uint8List> contractsControllerDownloadPdf({
    @Path('id') required String id,
    @Path('contractId') required String contractId,
  });
}
