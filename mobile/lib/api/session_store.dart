// hand-authored — where the mobile client keeps its tokens (Story 10.6).
//
// Access token: memory only (gone when the app is killed; restored from the
// refresh token). Refresh token: secure storage (Android Keystore / iOS
// Keychain), so reopening the app keeps the user signed in. Every storage call
// is guarded — a keystore reset or a restored backup behaves as "no stored
// token", never as a crash (same rule as localStorage on the web).
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Same key name as the web session store.
const String kRefreshTokenKey = 'pns.refreshToken';

/// The slice of secure storage the session needs; injected so tests run without a platform channel.
abstract class SecureKeyValueStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

/// Production store: Keystore / Keychain via flutter_secure_storage.
class FlutterSecureStorageStore implements SecureKeyValueStore {
  FlutterSecureStorageStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) => _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

class SessionStore {
  SessionStore(this._store);

  final SecureKeyValueStore _store;
  String? _accessToken;

  String? get accessToken => _accessToken;

  Future<String?> readRefreshToken() async {
    try {
      return await _store.read(kRefreshTokenKey);
    } catch (_) {
      return null;
    }
  }

  Future<void> setTokens({required String accessToken, required String refreshToken}) async {
    _accessToken = accessToken;
    try {
      await _store.write(kRefreshTokenKey, refreshToken);
    } catch (_) {
      // Storage unavailable: the session lives until the app is killed.
    }
  }

  Future<void> clear() async {
    _accessToken = null;
    try {
      await _store.delete(kRefreshTokenKey);
    } catch (_) {
      // Nothing stored that we could reach.
    }
  }
}
