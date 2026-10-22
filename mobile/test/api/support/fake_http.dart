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

/// A binary download (PDF, image) as the backend streams it.
ResponseBody bytesBody(int status, List<int> bytes, {String contentType = 'application/pdf'}) => ResponseBody.fromBytes(
      bytes,
      status,
      headers: {
        Headers.contentTypeHeader: [contentType],
      },
    );

/// Wraps [inner] in a backend whose first access token has just expired: any
/// private request still carrying `access-1` is answered 401, `/auth/refresh`
/// issues `access-2`, and the replay reaches [inner]. With [onlyPath], only
/// that path is refused — so the 401 lands on a LATER call of a method that
/// makes several (a metadata read, then the download).
FakeHandler renewingOnce(FakeHandler inner, {String? onlyPath}) => (request) {
      if (request.path == '/auth/refresh') return jsonBody(200, tokens('access-2', 'refresh-2'));
      if (request.authorization == 'Bearer access-1' && (onlyPath == null || request.path == onlyPath)) {
        return jsonBody(401, envelope('UNAUTHENTICATED', 'Phiên đăng nhập đã hết hạn.'));
      }
      return inner(request);
    };

/// One part of a multipart/form-data body, as the server reads it.
class FormPart {
  FormPart(this.headers, this.body);

  /// Header names lower-cased.
  final Map<String, String> headers;
  final List<int> body;

  String get disposition => headers['content-disposition'] ?? '';
  String? get name => RegExp(r'\bname="([^"]*)"').firstMatch(disposition)?.group(1);
  String? get filename => RegExp(r'\bfilename="([^"]*)"').firstMatch(disposition)?.group(1);
  String? get contentType => headers['content-type'];
  String get text => utf8.decode(body);
}

/// The content type the request declared (`multipart/form-data; boundary=…`).
String requestContentType(RecordedRequest request) =>
    (request.headers.entries.firstWhere((e) => e.key.toLowerCase() == 'content-type').value as Object).toString();

/// Splits a recorded multipart body into its parts.
List<FormPart> formParts(RecordedRequest request) {
  final boundary = RegExp(r'boundary=(.+)$').firstMatch(requestContentType(request))!.group(1)!;
  final raw = latin1.decode(request.body);
  final parts = <FormPart>[];
  for (final chunk in raw.split('--$boundary').skip(1)) {
    if (chunk.startsWith('--')) break;
    final split = chunk.indexOf('\r\n\r\n');
    final headers = <String, String>{
      for (final line in chunk.substring(2, split).split('\r\n'))
        line.substring(0, line.indexOf(':')).toLowerCase(): line.substring(line.indexOf(':') + 1).trim(),
    };
    final content = chunk.substring(split + 4, chunk.length - 2);
    parts.add(FormPart(headers, latin1.encode(content)));
  }
  return parts;
}

/// A backend answering by `METHOD path` (escapes kept); any other request is a 500
/// envelope the test would notice.
FakeHandler routes(Map<String, ResponseBody Function()> table) => (request) {
      final answer = table['${request.method} ${request.path}'];
      return answer == null
          ? jsonBody(500, envelope('INTERNAL', 'unexpected ${request.method} ${request.path}'))
          : answer();
    };
