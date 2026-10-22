// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.6
// ShareButton.tsx / share.ts). Opens the OS share sheet via share_plus — it does
// NOT draw its own grid of share apps (Zalo/Messenger…); the OS provides that.
// It only shares XFiles the caller already holds — it never uploads (AD-3).

import 'package:flutter/widgets.dart';
import 'package:share_plus/share_plus.dart';

import 'button.dart';

/// Outcome of a share attempt.
enum AppShareResult { shared, dismissed, unsupported }

/// The share implementation. Injected in tests so no real platform channel is
/// hit on the test VM; defaults to [platformShareXFiles] in production.
///
/// [fileNames] names each file in the share sheet. On Android/iOS an
/// `XFile.fromData(name: …)` keeps no name (an in-memory XFile's name comes from
/// its empty path), so without it the receiver gets a random one.
typedef AppShareFn = Future<AppShareResult> Function(
  List<XFile> files, {
  String? title,
  String? text,
  List<String>? fileNames,
});

/// Default wiring to the native share sheet. The caller orders `files` as
/// [image, pdf] so the image is offered first (UX-DR-21).
Future<AppShareResult> platformShareXFiles(
  List<XFile> files, {
  String? title,
  String? text,
  List<String>? fileNames,
}) async {
  if (files.isEmpty) return AppShareResult.unsupported;
  try {
    final result = await Share.shareXFiles(files, subject: title, text: text, fileNameOverrides: fileNames);
    return result.status == ShareResultStatus.dismissed
        ? AppShareResult.dismissed
        : AppShareResult.shared;
  } catch (_) {
    // Never throw out of a share tap (cancellation, unsupported platform…).
    return AppShareResult.unsupported;
  }
}

class AppShareButton extends StatelessWidget {
  const AppShareButton({
    super.key,
    this.files,
    this.title,
    this.text,
    this.label = 'Chia sẻ',
    this.variant = AppButtonVariant.outline,
    this.onResult,
    this.shareImpl,
  });

  /// Files to share; caller orders them [image, pdf] (image first).
  final List<XFile>? files;
  final String? title;
  final String? text;
  final String label;
  final AppButtonVariant variant;
  final ValueChanged<AppShareResult>? onResult;

  /// Injectable share function (fake in tests).
  final AppShareFn? shareImpl;

  @override
  Widget build(BuildContext context) {
    return AppButton(
      icon: 'ic-share',
      label: label,
      variant: variant,
      onPressed: () async {
        final share = shareImpl ?? platformShareXFiles;
        final result = await share(files ?? const [], title: title, text: text);
        onResult?.call(result);
      },
    );
  }
}
