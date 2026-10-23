// The call log behind the recording ports of the money and stock cubit tests
// (Story 11.4), the same shape as RecordingOrdersPort: every call in order with
// its arguments. A method named in [held] waits on a completer in [pending] until
// the test answers it — in any order, with a value (null ⇒ the fake's own answer)
// or an error. A method named in [errors] throws that error after it is logged;
// one named in [answers] returns that value instead of the fake's own answer.
import 'dart:async';

import 'package:pns_mobile/design_system/components/components.dart' show AppShareResult, XFile;

mixin RecordingPortCalls {
  /// Methods whose answer waits on [pending]. Mutable mid-test.
  final Set<String> held = <String>{};

  /// Method → what it throws. Mutable mid-test.
  final Map<String, Object> errors = <String, Object>{};

  /// Method → what it returns. Mutable mid-test.
  final Map<String, Object> answers = <String, Object>{};

  /// Method names in call order.
  final List<String> log = <String>[];

  /// The arguments of each call, parallel to [log].
  final List<List<Object?>> args = <List<Object?>>[];

  /// Method → the completers of its held calls, in call order.
  final Map<String, List<Completer<Object?>>> pending = <String, List<Completer<Object?>>>{};

  /// The arguments of every call to [method], in order.
  List<List<Object?>> argsOf(String method) => [
        for (var i = 0; i < log.length; i++)
          if (log[i] == method) args[i],
      ];

  /// The completer of the [n]-th held call to [method].
  Completer<Object?> pendingOf(String method, [int n = 0]) => pending[method]![n];

  Future<T> record<T>(String method, List<Object?> callArgs, Future<T> Function() real) async {
    log.add(method);
    args.add(callArgs);
    if (held.contains(method)) {
      final Completer<Object?> reply = Completer<Object?>();
      (pending[method] ??= <Completer<Object?>>[]).add(reply);
      final Object? value = await reply.future;
      if (value != null) return value as T;
    }
    final Object? error = errors[method];
    if (error != null) throw error;
    if (answers.containsKey(method)) return answers[method] as T;
    return real();
  }
}

/// One call of the share seam. No file name: an in-memory XFile keeps none, which
/// is why [fileNames] travels beside it.
typedef SharedCall = ({List<String> mimeTypes, String? title, List<String>? fileNames});

/// The share seam the cubits receive from their screen: records each call, then
/// answers `shared` — or throws [error] when set.
class RecordingShare {
  final List<SharedCall> calls = <SharedCall>[];
  Object? error;

  Future<AppShareResult> call(List<XFile> files, {String? title, String? text, List<String>? fileNames}) async {
    calls.add((
      mimeTypes: [for (final XFile f in files) f.mimeType ?? ''],
      title: title,
      fileNames: fileNames,
    ));
    final Object? err = error;
    if (err != null) throw err;
    return AppShareResult.shared;
  }
}
