// hand-authored — gathers a download into one buffer (Story 10.8).
//
// The generated download methods return `Stream<Uint8List>`; the request runs
// only once the stream is listened to. Adapters call this INSIDE
// `transport.call`, so a failed download (404 envelope, network, 401 replay)
// surfaces there as an ApiError like any other call.
import 'dart:typed_data';

Future<Uint8List> collectBytes(Stream<List<int>> stream) async {
  final builder = BytesBuilder(copy: false);
  await for (final chunk in stream) {
    builder.add(chunk);
  }
  return builder.takeBytes();
}
