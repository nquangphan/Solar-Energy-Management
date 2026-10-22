// Drift-guard for the generated client (Story 10.6, AD-12).
//
// lib/api/generated/** must be exactly what `dart run tool/generate_api.dart`
// produces from backend/openapi/openapi.json today. The byte check reruns the
// SAME script in a temp copy of the package — no second generation path.
// test/api/build_mobile_spec_test.dart pins the binary-response rewrite count.
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../tool/generate_api.dart';

const String regenHint = 'regenerate: cd mobile && dart run tool/generate_api.dart';

/// Relative path ⇒ bytes for every file under [root].
Map<String, List<int>> snapshot(Directory root) {
  final files = <String, List<int>>{};
  for (final entity in root.listSync(recursive: true)) {
    if (entity is File) {
      files[entity.path.substring(root.path.length + 1)] = entity.readAsBytesSync();
    }
  }
  return files;
}

String flutterTool(String name) {
  final root = Platform.environment['FLUTTER_ROOT'];
  if (root == null || root.isEmpty) {
    fail('FLUTTER_ROOT is not set — run this test with `flutter test` (it sets FLUTTER_ROOT).');
  }
  return '$root/bin/$name';
}

Future<void> run(String executable, List<String> args, String cwd) async {
  final result = await Process.run(executable, args, workingDirectory: cwd);
  if (result.exitCode != 0) {
    fail('`$executable ${args.join(' ')}` exited with ${result.exitCode}\n${result.stdout}\n${result.stderr}');
  }
}

void main() {
  final committed = Directory(generatedDir);

  test('the generated client exists and every declared part file is present', () {
    expect(committed.existsSync(), isTrue, reason: '$generatedDir is missing — $regenHint');
    final sources = committed
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart') && !f.path.endsWith('.g.dart'))
        .toList();
    expect(sources.length, greaterThan(100), reason: 'the generated client looks empty — $regenHint');
    final partPattern = RegExp(r"^part '([^']+\.g\.dart)';", multiLine: true);
    var parts = 0;
    for (final source in sources) {
      for (final match in partPattern.allMatches(source.readAsStringSync())) {
        parts++;
        final part = File('${source.parent.path}/${match.group(1)}');
        expect(part.existsSync(), isTrue, reason: '${part.path} is missing — $regenHint');
      }
    }
    expect(parts, greaterThan(0));
  });

  test(
    'regenerating from the current backend spec gives the committed files byte-for-byte',
    () async {
      final stopwatch = Stopwatch()..start();
      final temp = Directory.systemTemp.createTempSync('pns_api_drift_');
      try {
        // Same layout as the repo: <temp>/backend/openapi/openapi.json + <temp>/mobile/.
        final backend = Directory('${temp.path}/backend/openapi')..createSync(recursive: true);
        File(backendSpecPath).copySync('${backend.path}/openapi.json');
        final mobile = Directory('${temp.path}/mobile')..createSync();
        for (final name in ['pubspec.yaml', 'pubspec.lock', 'swagger_parser.yaml', 'build.yaml', 'analysis_options.yaml']) {
          File(name).copySync('${mobile.path}/$name');
        }
        Directory('${mobile.path}/tool').createSync();
        File('tool/generate_api.dart').copySync('${mobile.path}/tool/generate_api.dart');

        await run(flutterTool('flutter'), ['pub', 'get', '--offline'], mobile.path);
        await run(flutterTool('dart'), ['run', 'tool/generate_api.dart'], mobile.path);

        final expected = snapshot(Directory('${mobile.path}/$generatedDir'));
        final actual = snapshot(committed);
        final missing = expected.keys.where((k) => !actual.containsKey(k)).toList()..sort();
        final extra = actual.keys.where((k) => !expected.containsKey(k)).toList()..sort();
        final changed = expected.keys
            .where((k) => actual.containsKey(k) && !listEquals(actual[k], expected[k]))
            .toList()
          ..sort();
        expect(expected, isNotEmpty);
        expect([...missing, ...extra, ...changed], isEmpty,
            reason: 'generated client drifted from backend/openapi/openapi.json — $regenHint\n'
                'missing: $missing\nunexpected: $extra\nchanged: $changed');
      } finally {
        temp.deleteSync(recursive: true);
        // ignore: avoid_print
        print('generated client drift check: ${stopwatch.elapsed.inSeconds}s');
      }
    },
    timeout: const Timeout(Duration(minutes: 3)),
  );
}
