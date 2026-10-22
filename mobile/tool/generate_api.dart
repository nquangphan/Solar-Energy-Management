// hand-authored — regenerates the mobile HTTP client from the backend contract
// (Story 10.6, AD-12: the client is generated, contract types are never typed by hand).
//
// Run from mobile/: `dart run tool/generate_api.dart`.
//   1. reads ../backend/openapi/openapi.json and writes the derived spec
//      .dart_tool/pns_api/openapi.mobile.json (see buildMobileSpec);
//   2. deletes lib/api/generated/ and runs swagger_parser (swagger_parser.yaml);
//   3. runs build_runner for the json_serializable / retrofit .g.dart parts.
// test/api/generated_client_drift_test.dart reruns this in a temp copy and
// compares every generated file byte-for-byte, so script and guard share ONE path.
import 'dart:convert';
import 'dart:io';

/// Mobile package root, from this script's location (never from the cwd).
final Directory mobileRoot = File.fromUri(Platform.script).parent.parent;

const String backendSpecPath = '../backend/openapi/openapi.json';
const String mobileSpecPath = '.dart_tool/pns_api/openapi.mobile.json';
const String generatedDir = 'lib/api/generated';

/// `paidOn` of RecordPaymentRequestDto and PaymentResponseDto: fewer means the
/// date rewrite went blind.
const int minDateRewrites = 2;

/// Derives the spec swagger_parser reads from the backend spec.
///
/// The backend declares file downloads the standard way (`type: string,
/// format: binary`); swagger_parser turns that into `Stream<String>` decoded
/// as UTF-8, which corrupts a PDF or an image. Its documented switch for
/// `Stream<Uint8List>` is `type: integer, format: binary`. Only RESPONSE
/// schemas under a non-JSON media type are rewritten: multipart request
/// bodies (uploads) and JSON stay untouched.
///
/// Calendar dates (`type: string, format: date`, e.g. `paidOn`) lose their
/// `format`: swagger_parser would generate `DateTime`, whose toJson sends
/// `2026-10-21T00:00:00.000` (the backend accepts only `YYYY-MM-DD`) and whose
/// parse lands on local midnight. Kept as `String`, the date travels verbatim.
/// `format: date-time` is untouched. The backend spec itself is never edited.
({String json, int binaryRewrites, int dateRewrites}) buildMobileSpec(String specJson) {
  final spec = jsonDecode(specJson) as Map<String, dynamic>;
  var rewrites = 0;
  var dateRewrites = 0;
  void stripDateFormat(Object? node) {
    if (node is Map<String, dynamic>) {
      if (node['type'] == 'string' && node['format'] == 'date') {
        node.remove('format');
        dateRewrites++;
      }
      node.values.forEach(stripDateFormat);
    } else if (node is List) {
      node.forEach(stripDateFormat);
    }
  }

  stripDateFormat(spec);
  final paths = spec['paths'] as Map<String, dynamic>? ?? const {};
  for (final operations in paths.values) {
    for (final operation in (operations as Map<String, dynamic>).values) {
      if (operation is! Map<String, dynamic>) continue;
      final responses = operation['responses'] as Map<String, dynamic>? ?? const {};
      for (final response in responses.values) {
        final content = (response as Map<String, dynamic>)['content'] as Map<String, dynamic>?;
        if (content == null) continue;
        content.forEach((mediaType, media) {
          if (mediaType == 'application/json') return;
          final schema = (media as Map<String, dynamic>)['schema'];
          if (schema is Map<String, dynamic> && schema['type'] == 'string' && schema['format'] == 'binary') {
            schema['type'] = 'integer';
            rewrites++;
          }
        });
      }
    }
  }
  return (
    json: '${const JsonEncoder.withIndent('  ').convert(spec)}\n',
    binaryRewrites: rewrites,
    dateRewrites: dateRewrites,
  );
}

Future<void> _run(String executable, List<String> args) async {
  stdout.writeln('> $executable ${args.join(' ')}');
  final process = await Process.start(executable, args,
      workingDirectory: mobileRoot.path, mode: ProcessStartMode.inheritStdio);
  final code = await process.exitCode;
  if (code != 0) {
    stderr.writeln('generate_api: `${args.join(' ')}` exited with $code');
    exit(code);
  }
}

Future<void> main() async {
  final source = File('${mobileRoot.path}/$backendSpecPath');
  final derived = buildMobileSpec(source.readAsStringSync());
  if (derived.binaryRewrites == 0) {
    stderr.writeln('generate_api: no binary response found in $backendSpecPath — '
        'downloads would be generated as Stream<String>.');
    exit(1);
  }
  if (derived.dateRewrites < minDateRewrites) {
    stderr.writeln('generate_api: expected at least $minDateRewrites `format: date` schemas in '
        '$backendSpecPath, rewrote ${derived.dateRewrites} — paidOn would be generated as DateTime.');
    exit(1);
  }
  final target = File('${mobileRoot.path}/$mobileSpecPath');
  target.parent.createSync(recursive: true);
  target.writeAsStringSync(derived.json);

  final out = Directory('${mobileRoot.path}/$generatedDir');
  if (out.existsSync()) out.deleteSync(recursive: true);

  // `dart run` executes this script, so the same dart runs the generators.
  final dart = Platform.resolvedExecutable;
  await _run(dart, ['run', 'swagger_parser']);
  await _run(dart, ['run', 'build_runner', 'build']);
}
