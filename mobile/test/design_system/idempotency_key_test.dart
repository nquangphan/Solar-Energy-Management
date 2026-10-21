// hand-authored — unit test for the client idempotency key (Story 7.2).

import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/session/idempotency_key.dart';

final RegExp _uuidV4 = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
);

void main() {
  test('newIdempotencyKey is a lowercase RFC 4122 UUID v4', () {
    for (int i = 0; i < 1000; i++) {
      expect(newIdempotencyKey(), matches(_uuidV4));
    }
  });

  test('1000 keys never repeat', () {
    final Set<String> keys = <String>{
      for (int i = 0; i < 1000; i++) newIdempotencyKey(),
    };
    expect(keys, hasLength(1000));
  });
}
