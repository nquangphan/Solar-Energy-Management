// buildMobileSpec (Story 10.6): the derived spec swagger_parser reads rewrites
// ONLY binary response schemas (so downloads become Stream<Uint8List>) and
// leaves everything else — JSON responses, multipart upload bodies — untouched.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import '../../tool/generate_api.dart';

/// Counts binary response contents by a walk independent of buildMobileSpec:
/// every `{type: string, format: binary}` reached under a `responses` key.
int countBinaryResponses(Object? node, {bool inResponses = false}) {
  var count = 0;
  if (node is Map) {
    if (inResponses && node['type'] == 'string' && node['format'] == 'binary') count++;
    node.forEach((key, value) {
      count += countBinaryResponses(value, inResponses: inResponses || key == 'responses');
    });
  } else if (node is List) {
    for (final item in node) {
      count += countBinaryResponses(item, inResponses: inResponses);
    }
  }
  return count;
}

void main() {
  final specJson = File(backendSpecPath).readAsStringSync();

  test('rewrites exactly the binary response contents of the backend spec (> 0)', () {
    final expected = countBinaryResponses(jsonDecode(specJson));
    expect(expected, greaterThan(0), reason: 'the backend spec declares no file download any more');
    final derived = buildMobileSpec(specJson);
    expect(derived.binaryRewrites, expected);
    expect(countBinaryResponses(jsonDecode(derived.json)), 0,
        reason: 'a binary response left as type: string generates Stream<String> (UTF-8 decoded)');
  });

  test('changes nothing else: undoing the rewrites gives the backend spec back', () {
    final derived = jsonDecode(buildMobileSpec(specJson).json) as Map<String, dynamic>;
    var undone = 0;
    for (final operations in (derived['paths'] as Map<String, dynamic>).values) {
      for (final operation in (operations as Map<String, dynamic>).values) {
        for (final response in ((operation as Map<String, dynamic>)['responses'] as Map<String, dynamic>).values) {
          final content = (response as Map<String, dynamic>)['content'] as Map<String, dynamic>? ?? {};
          for (final media in content.values) {
            final schema = (media as Map<String, dynamic>)['schema'] as Map<String, dynamic>?;
            if (schema?['type'] == 'integer' && schema?['format'] == 'binary') {
              schema!['type'] = 'string';
              undone++;
            }
          }
        }
      }
    }
    expect(undone, greaterThan(0));
    expect(jsonEncode(derived), jsonEncode(jsonDecode(specJson)));
  });

  test('leaves multipart request bodies and JSON responses alone', () {
    const synthetic = '''
{"paths": {"/upload": {"post": {
  "requestBody": {"content": {"multipart/form-data": {"schema": {"type": "object",
    "properties": {"files": {"type": "array", "items": {"type": "string", "format": "binary"}}}}}}},
  "responses": {
    "200": {"content": {"application/json": {"schema": {"type": "string", "format": "binary"}}}},
    "201": {"content": {"application/pdf": {"schema": {"type": "string", "format": "binary"}}}},
    "204": {"description": "no content"}
  }}}}}''';
    final derived = buildMobileSpec(synthetic);
    expect(derived.binaryRewrites, 1);
    final op = (jsonDecode(derived.json) as Map)['paths']['/upload']['post'] as Map;
    expect(op['requestBody']['content']['multipart/form-data']['schema']['properties']['files']['items']['type'],
        'string');
    expect(op['responses']['200']['content']['application/json']['schema']['type'], 'string');
    expect(op['responses']['201']['content']['application/pdf']['schema']['type'], 'integer');
  });

  test('is deterministic (same input, same bytes)', () {
    expect(buildMobileSpec(specJson).json, buildMobileSpec(specJson).json);
  });
}
