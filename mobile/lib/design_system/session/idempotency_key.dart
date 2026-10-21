// hand-authored — client-side idempotency key (Story 7.2). The web twin uses
// `crypto.randomUUID()`; mobile has no uuid package and adds none.

import 'dart:math';

final Random _random = Random.secure();

/// A random UUID v4 (RFC 4122) from a cryptographically secure source: the key a
/// money write is retried with, generated ONCE per opened form.
String newIdempotencyKey() {
  final List<int> b = List<int>.generate(16, (_) => _random.nextInt(256));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  final String hex =
      b.map((int x) => x.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}
