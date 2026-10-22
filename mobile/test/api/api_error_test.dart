// parseEnvelope (Story 10.6, AD-5): accepts a map, JSON text or UTF-8 bytes;
// drops malformed field errors; anything that is not an envelope is null.
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/api_error.dart';

void main() {
  const body = {
    'code': 'VALIDATION_ERROR',
    'message': 'Dữ liệu không hợp lệ.',
    'fieldErrors': [
      {'field': 'email', 'code': 'isEmail', 'message': 'Email không hợp lệ.'},
      {'field': 'password'},
      'junk',
    ],
    'traceId': 't-1',
  };

  test('parses a decoded map, JSON text and UTF-8 bytes alike', () {
    for (final input in <Object>[body, jsonEncode(body), utf8.encode(jsonEncode(body))]) {
      final error = parseEnvelope(input, status: 400)!;
      expect(error.message, 'Dữ liệu không hợp lệ.');
      expect(error.code, 'VALIDATION_ERROR');
      expect(error.status, 400);
      expect(error.traceId, 't-1');
      expect(error.fieldErrors!.map((e) => e.field), ['email']);
      expect(error.fieldErrors!.single.message, 'Email không hợp lệ.');
    }
  });

  test('returns null for anything that is not an envelope', () {
    for (final input in <Object?>[
      null,
      '',
      '<html>502</html>',
      utf8.encode('<html>'),
      [0xff, 0xfe],
      {'message': 'no code'},
      {'code': 1, 'message': 'x'},
      ['code', 'message'],
    ]) {
      expect(parseEnvelope(input), isNull, reason: '$input');
    }
  });

  test('toString is the user-facing message', () {
    expect(ApiError(kGenericErrorMessage).toString(), kGenericErrorMessage);
  });
}
