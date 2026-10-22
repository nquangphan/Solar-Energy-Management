// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/auth_tokens_dto.dart';
import '../models/change_password_request_dto.dart';
import '../models/forgot_password_request_dto.dart';
import '../models/forgot_password_response_dto.dart';
import '../models/login_request_dto.dart';
import '../models/logout_request_dto.dart';
import '../models/me_response_dto.dart';
import '../models/refresh_request_dto.dart';
import '../models/reset_password_request_dto.dart';

part 'auth_client.g.dart';

@RestApi()
abstract class AuthClient {
  factory AuthClient(Dio dio, {String? baseUrl}) = _AuthClient;

  @POST('/auth/login')
  Future<AuthTokensDto> authControllerLogin({
    @Body() required LoginRequestDto body,
  });

  @POST('/auth/refresh')
  Future<AuthTokensDto> authControllerRefresh({
    @Body() required RefreshRequestDto body,
  });

  @POST('/auth/logout')
  Future<void> authControllerLogout({
    @Body() required LogoutRequestDto body,
  });

  @POST('/auth/forgot-password')
  Future<ForgotPasswordResponseDto> authControllerForgotPassword({
    @Body() required ForgotPasswordRequestDto body,
  });

  @POST('/auth/reset-password')
  Future<void> authControllerResetPassword({
    @Body() required ResetPasswordRequestDto body,
  });

  @POST('/auth/change-password')
  Future<void> changePasswordControllerChangePassword({
    @Body() required ChangePasswordRequestDto body,
  });

  @GET('/me')
  Future<MeResponseDto> meControllerMe();
}
