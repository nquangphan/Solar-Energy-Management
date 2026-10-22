// hand-authored — the mobile client's ONLY network boundary (Story 10.6, AD-12 client rule).
//
// Mobile twin of web/src/api/transport.ts. The generated client (retrofit) runs
// on the Dio built here. This is the one place that:
//   - builds a Dio / touches the network (guard: test/api/no_network_outside_transport_test.dart);
//   - attaches `Authorization: Bearer <access>` (never on the public auth routes);
//   - turns an error response into an ApiError (AD-5 envelope parsed here and only
//     here), so adapters only ever see data or an ApiError;
//   - renews the session on 401: ONE refresh shared by every waiting request, each
//     request replayed AT MOST once.
//
// 401 means different things per route: wrong credentials on /auth/login, a dead
// refresh token on /auth/refresh, a wrong current password on change-password.
// Hence the rules: no refresh for the public auth routes; a replay that is still
// 401 surfaces as an ApiError (the session is kept); only a failed REFRESH clears
// the session and reports it expired.
import 'dart:io';

import 'package:dio/dio.dart';

import 'api_error.dart';
import 'generated/models/auth_tokens_dto.dart';
import 'generated/models/logout_request_dto.dart';
import 'generated/models/refresh_request_dto.dart';
import 'session_store.dart';

/// Routes that authenticate by their body, not by a bearer — a 401 there is an answer, not an expired token.
const Set<String> kPublicAuthPaths = {
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
};

const String _sentTokenKey = 'pns.sentToken';
const String _replayedKey = 'pns.replayed';

class Transport {
  Transport({
    required String baseUrl,
    required SessionStore session,
    HttpClientAdapter? adapter,
    void Function()? onSessionExpired,
  })  : _session = session,
        _onSessionExpired = onSessionExpired,
        _basePath = Uri.parse(baseUrl).path.replaceFirst(RegExp(r'/$'), '') {
    final options = BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 60),
    );
    dio = Dio(options);
    // The renewal call bypasses the interceptor: a 401 there must never trigger another renewal.
    _bare = Dio(options);
    if (adapter != null) {
      dio.httpClientAdapter = adapter;
      _bare.httpClientAdapter = adapter;
    }
    dio.interceptors.add(InterceptorsWrapper(onRequest: _onRequest, onError: _onError));
  }

  final SessionStore _session;
  final void Function()? _onSessionExpired;
  final String _basePath;

  /// Handed to the generated PnsApiClient at the composition root.
  late final Dio dio;
  late final Dio _bare;

  // The renewal in flight; completes with null on success, or the error to throw.
  Future<ApiError?>? _refreshing;
  // The session generation that renewal belongs to: a request of a LATER session never
  // joins it (its outcome is the old session's, and a new session needs its own renewal).
  int _refreshingGeneration = 0;

  /// Trades the stored refresh token for new tokens; shares an in-flight renewal.
  Future<bool> refreshSession() async => await _renewOnce() == null;

  /// Runs a generated-client call and unwraps transport failures, so an adapter
  /// sees an [ApiError] (or a cancellation) and never needs `package:dio`.
  Future<T> call<T>(Future<T> Function() request) async {
    try {
      return await request();
    } on ApiError {
      rethrow;
    } on DioException catch (e) {
      final error = e.error;
      if (error is ApiError) throw error;
      if (e.type == DioExceptionType.cancel) rethrow;
      throw ApiError(kGenericErrorMessage);
    } catch (_) {
      // A 2xx body the generated fromJson cannot read (missing field, wrong type):
      // the screen gets the generic message, never a TypeError.
      throw ApiError(kGenericErrorMessage);
    }
  }

  String _routeOf(RequestOptions options) {
    final path = options.uri.path;
    if (_basePath.isEmpty) return path;
    if (path == _basePath) return '/';
    return path.startsWith('$_basePath/') ? path.substring(_basePath.length) : path;
  }

  bool _isPublic(RequestOptions options) => kPublicAuthPaths.contains(_routeOf(options));

  void _onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (!_isPublic(options)) {
      final token = _session.accessToken;
      options.extra[_sentTokenKey] = token;
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      } else {
        options.headers.remove('Authorization');
      }
    }
    handler.next(options);
  }

  Future<void> _onError(DioException err, ErrorInterceptorHandler handler) async {
    try {
      final options = err.requestOptions;
      final renewable = err.type == DioExceptionType.badResponse &&
          err.response?.statusCode == 401 &&
          !_isPublic(options) &&
          options.extra[_replayedKey] != true;
      if (!renewable) return handler.reject(await _toApiException(err));

      final sent = options.extra[_sentTokenKey] as String?;
      // Another request may already have renewed the session while this one was in flight.
      final current = _session.accessToken;
      // Sent with a token that is gone now: the session ended while this request was in
      // flight (a failed renewal already reported it, or a logout). Renewing again would
      // report the same expiry a second time.
      if (current == null && sent != null) return handler.reject(err.copyWith(error: _expired()));
      if (current == sent) {
        final failure = await _renewOnce();
        if (failure != null) return handler.reject(err.copyWith(error: failure));
      }

      options.extra[_replayedKey] = true;
      // A sent FormData is finalized and cannot be sent again.
      final data = options.data;
      if (data is FormData) options.data = data.clone();
      try {
        handler.resolve(await dio.fetch<dynamic>(options));
      } on DioException catch (replayError) {
        // Already converted by this interceptor (the replay went through it).
        handler.reject(replayError);
      }
    } catch (_) {
      handler.reject(err.copyWith(error: ApiError(kGenericErrorMessage)));
    }
  }

  Future<DioException> _toApiException(DioException err) async {
    switch (err.type) {
      case DioExceptionType.cancel:
        return err;
      case DioExceptionType.badResponse:
        final response = err.response;
        final status = response?.statusCode;
        final error = parseEnvelope(await _readBody(response?.data), status: status) ??
            ApiError(kGenericErrorMessage, status: status);
        return err.copyWith(error: error);
      case DioExceptionType.connectionError:
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
      case DioExceptionType.badCertificate:
        return err.copyWith(error: ApiError(kNetworkErrorMessage));
      case DioExceptionType.unknown:
        return err.copyWith(
            error: ApiError(err.error is SocketException ? kNetworkErrorMessage : kGenericErrorMessage));
    }
  }

  /// A `ResponseType.stream` error body arrives unread: drain it to bytes for parseEnvelope.
  static Future<Object?> _readBody(Object? data) async {
    if (data is! ResponseBody) return data;
    final bytes = <int>[];
    await for (final chunk in data.stream) {
      bytes.addAll(chunk);
    }
    return bytes;
  }

  ApiError _expired([String message = kSessionExpiredMessage]) =>
      ApiError(message, status: 401, code: 'UNAUTHENTICATED');

  Future<ApiError?> _renew() async {
    // A logout (or another login) while this renewal is in flight owns the session from
    // then on: the renewal's outcome must neither store tokens into it nor clear it, and
    // the user who signed out is not told the session expired.
    final generation = _session.generation;
    final refreshToken = await _session.readRefreshToken();
    var failure = _expired();
    if (refreshToken != null) {
      try {
        final response = await _bare.post<Object?>(
          '/auth/refresh',
          data: RefreshRequestDto(refreshToken: refreshToken).toJson(),
        );
        final data = response.data;
        if (data is Map) {
          final tokens = AuthTokensDto.fromJson(data.cast<String, Object?>());
          if (_session.generation != generation) {
            _revoke(tokens.refreshToken);
            return failure;
          }
          // The backend rotates the refresh token: keeping the old one fails the next renewal.
          await _session.setTokens(
              accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, renewal: true);
          return null;
        }
      } on DioException catch (e) {
        // Only the backend's own "refresh refused" (401 envelope) speaks for the session;
        // a 5xx or validation message would mislabel why the user is signed out.
        final response = e.response;
        if (response?.statusCode == 401) {
          final envelope = parseEnvelope(response!.data, status: 401);
          if (envelope != null) failure = _expired(envelope.message);
        }
      } catch (_) {
        // Unreadable body: the session cannot be renewed.
      }
    }
    if (_session.generation != generation) return failure;
    await _session.clear();
    _onSessionExpired?.call();
    return failure;
  }

  /// Revokes the session the server issued for a renewal nobody holds any more (a logout
  /// or a sign-in raced it): the logout sent the token this renewal had already rotated, so
  /// without this the new server session would outlive the sign-out. Best effort.
  void _revoke(String refreshToken) {
    _bare.post<Object?>('/auth/logout', data: LogoutRequestDto(refreshToken: refreshToken).toJson()).ignore();
  }

  Future<ApiError?> _renewOnce() {
    final current = _refreshing;
    if (current != null && _refreshingGeneration == _session.generation) return current;
    _refreshingGeneration = _session.generation;
    late final Future<ApiError?> renewal;
    renewal = _renew().whenComplete(() {
      if (identical(_refreshing, renewal)) _refreshing = null;
    });
    return _refreshing = renewal;
  }
}
