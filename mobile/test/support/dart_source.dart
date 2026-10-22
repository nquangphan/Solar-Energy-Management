// Reads Dart source as text for the source-guards (Story 10.6, shared since 10.7 by
// the network guard and the composition-root guard — one lexer, not two).

/// Removes comments (nested `/* */` as Dart allows). With [dropStrings], also
/// blanks string literal text while keeping `${...}` interpolations as code.
String stripDart(String src, {required bool dropStrings}) {
  final out = StringBuffer();

  bool identChar(int i) => i >= 0 && RegExp(r'[A-Za-z0-9_$]').hasMatch(src[i]);

  late int Function(int, {bool untilBrace}) lexCode;

  int lexString(int i) {
    var raw = false;
    if (src[i] == 'r' || src[i] == 'R') {
      raw = true;
      i++;
    }
    final quote = src[i];
    final delimiter = src.startsWith(quote * 3, i) ? quote * 3 : quote;
    out.write(delimiter);
    i += delimiter.length;
    while (i < src.length) {
      if (!raw && src[i] == r'\') {
        if (!dropStrings) out.write(src.substring(i, (i + 2).clamp(0, src.length)));
        i += 2;
        continue;
      }
      if (src.startsWith(delimiter, i)) {
        out.write(delimiter);
        return i + delimiter.length;
      }
      if (!raw && src.startsWith(r'${', i)) {
        out.write(r'${');
        i = lexCode(i + 2, untilBrace: true);
        out.write('}');
        i++;
        continue;
      }
      if (!dropStrings) out.write(src[i]);
      i++;
    }
    return i;
  }

  lexCode = (int i, {bool untilBrace = false}) {
    var depth = 0;
    while (i < src.length) {
      final c = src[i];
      if (src.startsWith('//', i)) {
        while (i < src.length && src[i] != '\n') {
          i++;
        }
        continue;
      }
      if (src.startsWith('/*', i)) {
        var nesting = 0;
        do {
          if (src.startsWith('/*', i)) {
            nesting++;
            i += 2;
          } else if (src.startsWith('*/', i)) {
            nesting--;
            i += 2;
          } else {
            i++;
          }
        } while (nesting > 0 && i < src.length);
        out.write(' ');
        continue;
      }
      final rawPrefix =
          (c == 'r' || c == 'R') && i + 1 < src.length && (src[i + 1] == "'" || src[i + 1] == '"') && !identChar(i - 1);
      if (c == "'" || c == '"' || rawPrefix) {
        i = lexString(i);
        continue;
      }
      if (untilBrace) {
        if (c == '{') depth++;
        if (c == '}') {
          if (depth == 0) return i;
          depth--;
        }
      }
      out.write(c);
      i++;
    }
    return i;
  };

  lexCode(0);
  return out.toString();
}
