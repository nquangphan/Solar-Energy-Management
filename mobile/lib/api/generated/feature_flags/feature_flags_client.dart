// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/feature_flag_response_dto.dart';
import '../models/toggle_feature_flag_request_dto.dart';

part 'feature_flags_client.g.dart';

@RestApi()
abstract class FeatureFlagsClient {
  factory FeatureFlagsClient(Dio dio, {String? baseUrl}) = _FeatureFlagsClient;

  @GET('/feature-flags')
  Future<List<FeatureFlagResponseDto>> featureFlagsControllerFindAll();

  @PATCH('/feature-flags/{key}')
  Future<FeatureFlagResponseDto> featureFlagsControllerToggle({
    @Path('key') required String key,
    @Body() required ToggleFeatureFlagRequestDto body,
  });
}
