// Test doubles for the mobile HTTP layer (Story 10.6): an in-memory secure
// store and an HttpClientAdapter that answers from a handler and records every
// request it receives — no socket is ever opened.
import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:pns_mobile/api/session_store.dart';

class MemoryKeyValueStore implements SecureKeyValueStore {
  final Map<String, String> values = {};
  bool failing = false;

  @override
  Future<String?> read(String key) async {
    if (failing) throw StateError('keystore unavailable');
    return values[key];
  }

  @override
  Future<void> write(String key, String value) async {
    if (failing) throw StateError('keystore unavailable');
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    if (failing) throw StateError('keystore unavailable');
    values.remove(key);
  }
}

class RecordedRequest {
  RecordedRequest(this.method, this.path, this.headers, this.body, {this.query = const {}});

  final String method;

  /// As sent on the wire — percent-escapes kept (`/customers/%2B849…`).
  final String path;

  /// Decoded query parameters, as the server reads them.
  final Map<String, String> query;
  final Map<String, dynamic> headers;
  final List<int> body;

  String? get authorization => headers['Authorization'] as String?;
  String get bodyText => utf8.decode(body);
  Object? get json => jsonDecode(bodyText);
}

typedef FakeHandler = FutureOr<ResponseBody> Function(RecordedRequest request);

class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.handler);

  FakeHandler handler;
  final List<RecordedRequest> requests = [];

  Iterable<RecordedRequest> to(String path) => requests.where((r) => r.path == path);

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    final bytes = <int>[];
    if (requestStream != null) {
      await for (final chunk in requestStream) {
        bytes.addAll(chunk);
      }
    }
    final request = RecordedRequest(options.method, options.uri.path, Map.of(options.headers), bytes,
        query: options.uri.queryParameters);
    requests.add(request);
    return handler(request);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody jsonBody(int status, Object? body) => ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );

ResponseBody textBody(int status, String body, {String contentType = 'text/html'}) => ResponseBody.fromString(
      body,
      status,
      headers: {
        Headers.contentTypeHeader: [contentType],
      },
    );

ResponseBody noContent() => ResponseBody.fromString('', 204);

Map<String, Object?> envelope(String code, String message, {List<Object?>? fieldErrors}) => {
      'code': code,
      'message': message,
      'fieldErrors': fieldErrors ?? [],
      'traceId': 'trace-1',
    };

Map<String, Object?> tokens(String access, String refresh) =>
    {'accessToken': access, 'refreshToken': refresh, 'expiresIn': 900};

/// The connection failure Dio's IO adapter raises when the host is unreachable.
Never refuseConnection(RecordedRequest request) =>
    throw DioException.connectionError(requestOptions: RequestOptions(path: request.path), reason: 'refused');
