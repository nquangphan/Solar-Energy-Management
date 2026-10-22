// Source-guard (Story 10.6, AD-12 client rule): lib/api/transport.dart is the ONLY
// hand-written file that reaches the network, parses the AD-5 envelope, and the
// backend URL comes only from `--dart-define=API_BASE_URL` in lib/main.dart.
//
// Scans every hand-written .dart under lib/ (lib/api/generated/** is generated
// code that runs on the transport's Dio). Import rules read the source with
// comments removed but strings kept; identifier rules read it with strings blanked
// too — except string interpolations, which are code (`'${Dio()}'`).
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import '../support/dart_source.dart';

const String transportPath = 'lib/api/transport.dart';
const String apiErrorPath = 'lib/api/api_error.dart';
const String mainPath = 'lib/main.dart';

/// Imports that open a network channel on their own.
final RegExp bannedImport = RegExp(
  r'''(import|export)\s+['"](package:dio/|package:http/|package:web_socket_channel|dart:html|package:web/)''',
);

/// Network entry points; `Dio.new`, `d.Dio(` and the like all contain the identifier.
/// Flutter's and flutter_svg's network image loaders fetch a URL on their own (no
/// Bearer, no envelope) — an image from the backend must come through the transport.
final RegExp bannedIdentifier = RegExp(
  r'\b(Dio|HttpClient|Socket|RawSocket|SecureSocket|RawDatagramSocket|WebSocket|HttpRequest'
  r'|NetworkImage|NetworkAssetBundle|SvgNetworkLoader)\b|\b(Image|SvgPicture)\s*\.\s*network\b',
);

final RegExp hardcodedUrl = RegExp(r'https?://|10\.0\.2\.2|localhost');

List<File> handWrittenSources() => Directory('lib')
    .listSync(recursive: true)
    .whereType<File>()
    .where((f) => f.path.endsWith('.dart') && !f.path.startsWith('lib/api/generated/'))
    .toList();

void main() {
  final sources = {for (final f in handWrittenSources()) f.path: f.readAsStringSync()};

  test('scans the whole hand-written lib/ tree (not blind)', () {
    expect(sources.length, greaterThanOrEqualTo(60));
    expect(sources.keys, containsAll([transportPath, apiErrorPath, mainPath, 'lib/api/http_auth_port.dart']));
    expect(sources.keys.where((p) => p.startsWith('lib/api/generated/')), isEmpty);
  });

  test('the stripper keeps code, drops comments and (optionally) string text', () {
    const sample = '''
final a = 'a//b'; Dio();
// Dio() in a line comment
/* Dio( /* nested */ still a comment Dio( */
final b = "HttpClient(";
final c = r'Socket.connect';
final d = '\${Dio()}';
Image.network(u); SvgPicture.network(u); NetworkImage(u);
final f = 'Image.network(';
final e = \'\'\'multi
Dio( line\'\'\';
''';
    final noStrings = stripDart(sample, dropStrings: true);
    expect(bannedIdentifier.allMatches(noStrings).length, 5, reason: noStrings);
    // `'a//b'` is a string, not the start of a comment: the call after it survives.
    expect(noStrings, contains("final a = ''; Dio();"));
    final keepStrings = stripDart(sample, dropStrings: false);
    expect(keepStrings, contains('"HttpClient("'));
    expect(keepStrings, isNot(contains('line comment')));
    expect(keepStrings, isNot(contains('nested')));
  });

  test('positive self-check: transport.dart really builds a Dio and imports package:dio', () {
    final transport = sources[transportPath]!;
    expect(RegExp(r'\bDio\s*\(').hasMatch(stripDart(transport, dropStrings: true)), isTrue,
        reason: 'transport.dart no longer calls Dio( — the guard would be checking nothing');
    expect(bannedImport.hasMatch(stripDart(transport, dropStrings: false)), isTrue);
  });

  test('no file but transport.dart imports a network package', () {
    final offenders = [
      for (final MapEntry(key: path, value: src) in sources.entries)
        if (path != transportPath && bannedImport.hasMatch(stripDart(src, dropStrings: false))) path,
    ];
    expect(offenders, isEmpty, reason: 'only $transportPath may import a network package');
  });

  test('no file but transport.dart touches a network entry point', () {
    final offenders = [
      for (final MapEntry(key: path, value: src) in sources.entries)
        if (path != transportPath)
          for (final m in bannedIdentifier.allMatches(stripDart(src, dropStrings: true))) '$path: ${m[0]}',
    ];
    expect(offenders, isEmpty, reason: 'only $transportPath may reach the network');
  });

  test('the AD-5 envelope is parsed in transport.dart only', () {
    for (final MapEntry(key: path, value: src) in sources.entries) {
      final uses = RegExp(r'\bparseEnvelope\b').allMatches(stripDart(src, dropStrings: true)).length;
      if (path == transportPath) {
        expect(uses, greaterThan(0), reason: 'transport.dart must parse the envelope');
      } else if (path == apiErrorPath) {
        expect(uses, 1, reason: 'api_error.dart may only DEFINE parseEnvelope');
      } else {
        expect(uses, 0, reason: '$path calls parseEnvelope — only the transport may');
      }
    }
  });

  test('the backend URL comes only from API_BASE_URL in main.dart; no URL is hardcoded', () {
    final defines = [
      for (final MapEntry(key: path, value: src) in sources.entries)
        for (final _ in RegExp(r'fromEnvironment\(').allMatches(stripDart(src, dropStrings: true))) path,
    ];
    expect(defines, [mainPath]);
    expect(stripDart(sources[mainPath]!, dropStrings: false), contains("String.fromEnvironment('API_BASE_URL')"));
    final urls = [
      for (final MapEntry(key: path, value: src) in sources.entries)
        for (final m in hardcodedUrl.allMatches(stripDart(src, dropStrings: false))) '$path: ${m[0]}',
    ];
    expect(urls, isEmpty);
  });
}
