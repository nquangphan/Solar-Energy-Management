// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/invoice_detail_response_dto.dart';
import '../models/invoice_pdf_response_dto.dart';
import '../models/invoice_response_dto.dart';
import '../models/invoices_overview_response_dto.dart';

part 'invoices_client.g.dart';

@RestApi()
abstract class InvoicesClient {
  factory InvoicesClient(Dio dio, {String? baseUrl}) = _InvoicesClient;

  @GET('/orders/{id}/invoices')
  Future<InvoicesOverviewResponseDto> invoicesControllerOverview({
    @Path('id') required String id,
  });

  @POST('/orders/{id}/invoices')
  Future<InvoiceResponseDto> invoicesControllerCreate({
    @Path('id') required String id,
  });

  @GET('/orders/{id}/invoices/{invoiceId}')
  Future<InvoiceDetailResponseDto> invoicesControllerDetail({
    @Path('id') required String id,
    @Path('invoiceId') required String invoiceId,
  });

  @POST('/orders/{id}/invoices/{invoiceId}/pdf')
  Future<InvoicePdfResponseDto> invoicesControllerExportPdf({
    @Path('id') required String id,
    @Path('invoiceId') required String invoiceId,
  });

  @GET('/orders/{id}/invoices/{invoiceId}/pdf')
  @DioResponseType(ResponseType.stream)
  Stream<Uint8List> invoicesControllerDownloadPdf({
    @Path('id') required String id,
    @Path('invoiceId') required String invoiceId,
  });
}
