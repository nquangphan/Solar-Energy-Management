// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.6
// ImageUpload.tsx — `.thumbs`/`.thumb`/`.thumb.add`). Controlled picker.
//
// NO-UPLOAD INVARIANT (AD-3): this widget picks images (camera/gallery) and
// emits the chosen XFile[] via onAdd — nothing more. It does NOT talk to the
// network, R2, or signed URLs; the screen/backend owns persistence. Upload is
// ALWAYS optional — there is no "≥1 image required" validation (UX-DR-25).
//
// Previews use a LOCAL file (dart:io) only — never a remote fetch, keeping the
// no-network guarantee intact. A source-guard test forbids network APIs here.

import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:image_picker/image_picker.dart';

import '../icons/app_icons.dart';
import '../tokens/app_tokens.dart';
import 'button.dart';
import 'dashed_rect.dart';
import 'sheet.dart';

/// The `#b7c9c4` placeholder glyph colour — a canonical component constant.
const Color _thumbGlyph = Color(0xFFB7C9C4);

/// An already-chosen image. [path] points at a LOCAL file for preview (optional).
class AppUploadItem {
  const AppUploadItem({required this.id, this.path, this.name});
  final String id;
  final String? path;
  final String? name;
}

/// Picks images from the given source. Injected in tests (no platform channel
/// on the test VM); defaults to [platformPickImages].
typedef ImagePickFn = Future<List<XFile>> Function(ImageSource source);

/// Default wiring to the native picker (camera or gallery).
Future<List<XFile>> platformPickImages(ImageSource source) async {
  final file = await ImagePicker().pickImage(source: source);
  return file == null ? <XFile>[] : <XFile>[file];
}

class AppImageUpload extends StatelessWidget {
  const AppImageUpload({
    super.key,
    required this.images,
    required this.onAdd,
    this.onRemove,
    this.max,
    this.hint,
    this.pick,
  });

  final List<AppUploadItem> images;
  final ValueChanged<List<XFile>> onAdd;
  final ValueChanged<String>? onRemove;
  final int? max;
  final String? hint;

  /// Injectable picker (fake in tests).
  final ImagePickFn? pick;

  bool get _full => max != null && images.length >= max!;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Wrap(
          spacing: 8.0,
          runSpacing: 8.0,
          children: [
            for (final item in images) _thumb(item),
            if (!_full) _addTile(context),
          ],
        ),
        if (hint != null) ...[
          const SizedBox(height: 6.0),
          Text(
            hint!,
            style: const TextStyle(
              color: AppTokens.muted,
              fontFamily: AppTokens.fontFamily,
              fontSize: 10.0,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );
  }

  Widget _thumb(AppUploadItem item) {
    final box = Container(
      width: 74.0,
      height: 74.0,
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppTokens.surface2,
        border: Border.all(color: AppTokens.line, width: AppTokens.borderWidth),
        borderRadius: BorderRadius.circular(AppTokens.radiusDefault),
      ),
      child: item.path != null
          ? Image.file(File(item.path!),
              width: 74.0, height: 74.0, fit: BoxFit.cover)
          : const AppIcon('ic-image', size: 24.0, color: _thumbGlyph),
    );

    if (onRemove == null) return box;
    return Stack(
      children: [
        box,
        Positioned(
          top: 2.0,
          right: 2.0,
          // A11y (Story 1.10, UX-DR-26): icon-only remove control needs a label.
          child: Semantics(
            button: true,
            label: 'Xoá ảnh',
            child: GestureDetector(
              onTap: () => onRemove!(item.id),
              child: Container(
                padding: const EdgeInsets.all(2.0),
                decoration: const BoxDecoration(
                  color: AppTokens.surface,
                  shape: BoxShape.circle,
                ),
                child: const AppIcon('ic-close',
                    size: 12.0, color: AppTokens.ink2),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _addTile(BuildContext context) {
    // A11y (Story 1.10, UX-DR-26): icon-only add control needs a label. The 74px
    // tile already exceeds the ≥48dp touch floor.
    return Semantics(
      button: true,
      label: 'Thêm ảnh',
      child: GestureDetector(
        onTap: () => _openPickSheet(context),
        child: const SizedBox(
          width: 74.0,
          height: 74.0,
          child: CustomPaint(
            painter: DashedRectPainter(
              color: AppTokens.teal,
              strokeWidth: AppTokens.borderWidth,
              radius: AppTokens.radiusDefault,
            ),
            child: Center(
              child: AppIcon('ic-plus', size: 20.0, color: AppTokens.teal700),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _openPickSheet(BuildContext context) async {
    final picker = pick ?? platformPickImages;
    Future<void> choose(ImageSource source) async {
      Navigator.of(context).pop();
      final files = await picker(source);
      if (files.isNotEmpty) onAdd(files);
    }

    await showAppSheet<void>(
      context: context,
      child: AppSheet(
        title: 'Thêm ảnh',
        body: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppButton(
              icon: 'ic-camera',
              label: 'Chụp ảnh',
              variant: AppButtonVariant.outline,
              wide: true,
              onPressed: () => choose(ImageSource.camera),
            ),
            const SizedBox(height: 8.0),
            AppButton(
              icon: 'ic-image',
              label: 'Chọn từ thư viện',
              variant: AppButtonVariant.ghost,
              wide: true,
              onPressed: () => choose(ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
  }
}
