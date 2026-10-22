// SessionStore (Story 10.6): refresh token at rest in the injected secure
// store, access token in memory only, storage failures never crash.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/session_store.dart';

import 'support/fake_http.dart';

void main() {
  test('setTokens keeps the access token in memory and writes only the refresh token', () async {
    final store = MemoryKeyValueStore();
    final session = SessionStore(store);
    await session.setTokens(accessToken: 'access-1', refreshToken: 'refresh-1');
    expect(session.accessToken, 'access-1');
    expect(await session.readRefreshToken(), 'refresh-1');
    expect(store.values, {kRefreshTokenKey: 'refresh-1'});
    expect(store.values.values, isNot(contains('access-1')));
  });

  test('clear removes both tokens', () async {
    final store = MemoryKeyValueStore();
    final session = SessionStore(store);
    await session.setTokens(accessToken: 'a', refreshToken: 'r');
    await session.clear();
    expect(session.accessToken, isNull);
    expect(await session.readRefreshToken(), isNull);
    expect(store.values, isEmpty);
  });

  test('a failing secure store reads as "no token" and never throws', () async {
    final store = MemoryKeyValueStore()..failing = true;
    final session = SessionStore(store);
    expect(await session.readRefreshToken(), isNull);
    await session.setTokens(accessToken: 'a', refreshToken: 'r');
    expect(session.accessToken, 'a');
    await session.clear();
    expect(session.accessToken, isNull);
  });
}
