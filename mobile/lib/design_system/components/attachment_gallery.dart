// hand-authored — Flutter design-system component (Story 5.6, mirror
// web/src/design-system/components/AttachmentGallery.tsx).
//
// NO-NETWORK INVARIANT (AD-3): this widget renders photos ALREADY stored on the
// server, but it never fetches them. The SCREEN pulls bytes through the port's
// authenticated proxy call and hands each item a ready [AppAttachmentItem.bytes];
// this widget only lays them out. A source-guard test forbids network APIs here.
//
// It is a SEPARATE widget from AppImageUpload on purpose: that one is a picker
// for LOCAL files the user just chose, carries no uploader/timestamp metadata,
// and deletes without asking. This one is the read side.

import 'dart:typed_data';

import 'package:flutter/widgets.dart';

import '../icons/app_icons.dart';
import '../tokens/app_tokens.dart';

/// The `#b7c9c4` placeholder glyph colour — mirrors AppImageUpload.
const Color _thumbGlyph = Color(0xFFB7C9C4);

/// One photo already stored on the server.
class AppAttachmentItem {
  const AppAttachmentItem({
    required this.id,
    required this.fileName,
    required this.nguoiTaiLen,
    required this.createdAt,
    required this.coTheXoa,
    this.statusTo,
    this.buocLabel,
    this.bytes,
  });

  final String id;
  final String fileName;
  final String nguoiTaiLen;
  final String createdAt;

  /// Backend-computed (uploader OR order-edit permission). The widget only
  /// renders it — rebuilding the rule here would be a second copy (AD-2).
  final bool coTheXoa;

  /// Null ⇒ supplementary photo, belonging to no transition.
  final String? statusTo;

  /// Step badge text the SCREEN built from the status label table.
  final String? buocLabel;

  /// Preview bytes the SCREEN fetched through the port.
  final Uint8List? bytes;
}

/// Read-only gallery for photos already stored on the server (Story 5.6, FR-24).
///
/// The delete button is HIDDEN outright when [AppAttachmentItem.coTheXoa] is
/// false, never greyed out (UX-DR-22): a disabled control still advertises a
/// capability the caller does not have. Deleting reports intent through
/// [onDelete]; the screen owns the confirm dialog.
class AppAttachmentGallery extends StatelessWidget {
  const AppAttachmentGallery({
    super.key,
    required this.items,
    required this.onDelete,
    required this.emptyLabel,
  });

  final List<AppAttachmentItem> items;
  final ValueChanged<String> onDelete;
  final String emptyLabel;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Text(
        emptyLabel,
        style: const TextStyle(
          color: AppTokens.muted,
          fontFamily: AppTokens.fontFamily,
          fontSize: 13.0,
        ),
      );
    }
    return Wrap(
      spacing: 8.0,
      runSpacing: 8.0,
      children: <Widget>[for (final AppAttachmentItem item in items) _o(item)],
    );
  }

  Widget _o(AppAttachmentItem item) {
    return SizedBox(
      width: 96.0,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          _thumb(item),
          const SizedBox(height: 4.0),
          Text(
            item.statusTo == null ? 'Bổ sung' : (item.buocLabel ?? 'Bổ sung'),
            style: const TextStyle(
              color: AppTokens.ink2,
              fontFamily: AppTokens.fontFamily,
              fontSize: 10.0,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            item.nguoiTaiLen,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppTokens.muted,
              fontFamily: AppTokens.fontFamily,
              fontSize: 10.0,
            ),
          ),
          Text(
            item.createdAt,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppTokens.muted,
              fontFamily: AppTokens.fontFamily,
              fontSize: 10.0,
            ),
          ),
        ],
      ),
    );
  }

  Widget _thumb(AppAttachmentItem item) {
    final Widget box = Container(
      width: 96.0,
      height: 96.0,
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppTokens.surface2,
        border: Border.all(color: AppTokens.line, width: AppTokens.borderWidth),
        borderRadius: BorderRadius.circular(AppTokens.radiusDefault),
      ),
      child: item.bytes != null
          ? Image.memory(
              item.bytes!,
              width: 96.0,
              height: 96.0,
              fit: BoxFit.cover,
              // Undecodable bytes throw at paint; fall back to the placeholder
              // glyph instead of a red error box.
              errorBuilder: (_, __, ___) =>
                  const AppIcon('ic-image', size: 24.0, color: _thumbGlyph),
            )
          : const AppIcon('ic-image', size: 24.0, color: _thumbGlyph),
    );

    if (!item.coTheXoa) return box;
    return Stack(
      children: <Widget>[
        box,
        Positioned(
          top: 2.0,
          right: 2.0,
          // A11y (UX-DR-26): icon-only control needs a label; the 48dp box keeps
          // the touch target at the floor.
          child: Semantics(
            button: true,
            label: 'Xoá ảnh',
            child: GestureDetector(
              onTap: () => onDelete(item.id),
              child: Container(
                width: 48.0,
                height: 48.0,
                alignment: Alignment.center,
                child: Container(
                  padding: const EdgeInsets.all(4.0),
                  decoration: const BoxDecoration(
                    color: AppTokens.surface,
                    shape: BoxShape.circle,
                  ),
                  child: const AppIcon('ic-trash',
                      size: 14.0, color: AppTokens.ink2),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
