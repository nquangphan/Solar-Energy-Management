// hand-authored — the ONE error type every HTTP adapter throws (Story 10.6, AD-5).
//
// Mobile twin of web/src/api/api-error.ts. Only transport.dart builds it from a
// response (parseEnvelope); a screen reads `.message` / `.code` / `.fieldErrors`
// / `.status`. The three fallback messages match the web byte-for-byte
// (design-system/session/parity.test.mjs).
import 'dart:convert';

import 'generated/models/field_error_dto.dart';

/// Shown when the backend answered but the body is not an AD-5 envelope (proxy HTML 502, empty, foreign JSON).
const String kGenericErrorMessage = 'Không thực hiện được. Thử lại.';

/// Shown when the request never reached the backend (offline, DNS, timeout).
const String kNetworkErrorMessage = 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';

/// Shown when the session cannot be renewed and the backend gave no message.
const String kSessionExpiredMessage = 'Phiên đăng nhập đã hết hạn. Đăng nhập lại.';

class ApiError implements Exception {
  ApiError(this.message, {this.status, this.code, this.fieldErrors, this.traceId});

  final String message;

  /// HTTP status; absent when the request never reached the backend.
  final int? status;

  /// The envelope's `code` (AD-5) — screens branch on this, never on `message`.
  final String? code;

  final List<FieldErrorDto>? fieldErrors;
  final String? traceId;

  @override
  String toString() => message;
}

/// Minimal AD-5 check: an object with string `code` and `message`; malformed
/// field errors are dropped. Accepts a decoded `Map`, a JSON `String` or UTF-8
/// bytes. Returns null for anything else — never throws.
ApiError? parseEnvelope(Object? body, {int? status}) {
  Object? decoded = body;
  try {
    if (body is List<int>) decoded = jsonDecode(utf8.decode(body));
    if (body is String) decoded = jsonDecode(body);
  } on FormatException {
    return null;
  }
  if (decoded is! Map) return null;
  final code = decoded['code'];
  final message = decoded['message'];
  if (code is! String || message is! String) return null;
  final rawFieldErrors = decoded['fieldErrors'];
  final traceId = decoded['traceId'];
  return ApiError(
    message,
    status: status,
    code: code,
    fieldErrors: rawFieldErrors is List
        ? [
            for (final e in rawFieldErrors)
              if (e is Map && e['field'] is String && e['code'] is String && e['message'] is String)
                FieldErrorDto(field: e['field'] as String, code: e['code'] as String, message: e['message'] as String),
          ]
        : null,
    traceId: traceId is String && traceId.isNotEmpty ? traceId : null,
  );
}
