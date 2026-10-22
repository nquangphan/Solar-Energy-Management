// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/payment_schedule_response_dto.dart';
import '../models/record_payment_request_dto.dart';
import '../models/record_payment_response_dto.dart';
import '../models/replace_payment_schedule_request_dto.dart';

part 'payments_client.g.dart';

@RestApi()
abstract class PaymentsClient {
  factory PaymentsClient(Dio dio, {String? baseUrl}) = _PaymentsClient;

  @GET('/orders/{id}/payment-schedule')
  Future<PaymentScheduleResponseDto> paymentSchedulesControllerGet({
    @Path('id') required String id,
  });

  @PUT('/orders/{id}/payment-schedule')
  Future<PaymentScheduleResponseDto> paymentSchedulesControllerReplace({
    @Path('id') required String id,
    @Body() required ReplacePaymentScheduleRequestDto body,
  });

  @POST('/orders/{id}/payments')
  Future<RecordPaymentResponseDto> paymentsControllerRecord({
    @Path('id') required String id,
    @Body() required RecordPaymentRequestDto body,
  });
}
