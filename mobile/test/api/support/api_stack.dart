// The real HTTP stack over a FakeAdapter (Story 10.7): session store → transport →
// generated client, signed in, so an adapter test exercises Bearer, envelope parsing
// and refresh exactly as production does — only the socket is fake.
import 'package:pns_mobile/api/generated/pns_api_client.dart';
import 'package:pns_mobile/api/session_store.dart';
import 'package:pns_mobile/api/transport.dart';

import 'fake_http.dart';

class ApiStack {
  ApiStack(FakeHandler handler) : adapter = FakeAdapter(handler) {
    transport = Transport(
      baseUrl: 'http://backend.test',
      session: session,
      adapter: adapter,
      onSessionExpired: () => expiredCalls++,
    );
    client = PnsApiClient(transport.dio);
  }

  final FakeAdapter adapter;
  final MemoryKeyValueStore store = MemoryKeyValueStore();
  late final SessionStore session = SessionStore(store);
  late final Transport transport;
  late final PnsApiClient client;
  int expiredCalls = 0;

  Future<ApiStack> signedIn() async {
    await session.setTokens(accessToken: 'access-1', refreshToken: 'refresh-1');
    return this;
  }
}
