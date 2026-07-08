// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.6
// CartLineRow.tsx). A single editable cart line.
//
// MONEY INVARIANT (AD-10/16) — THE most important guard in this story:
// `amount` is a number the BACKEND computed (POST /orders/preview-total) and is
// rendered STRAIGHT from the prop. This widget NEVER multiplies quantity by unit
// price, never sums, never formats money. Edits only emit the new number via
// onQtyChange/onUnitPriceChange; the SCREEN re-queries preview-total and passes
// a fresh `amount` back. A runtime test (amount independent of qty/price) plus a
// source-guard enforce this.

import 'package:flutter/widgets.dart';

import '../icons/app_icons.dart';
import '../tokens/app_tokens.dart';
import 'button.dart';
import 'field.dart';

const Color _zebraFill = Color(0xFFF7FBFA);

class AppCartLineRow extends StatelessWidget {
  const AppCartLineRow({
    super.key,
    required this.name,
    this.id,
    this.sku,
    this.meta,
    required this.qty,
    required this.unitPrice,
    required this.amount,
    this.editable = false,
    this.flag,
    this.zebra = false,
    this.onQtyChange,
    this.onUnitPriceChange,
    this.onDelete,
  });

  final String name;

  /// Stable line identity for the swipe key. A cart may hold two lines with the
  /// same [name], so the Dismissible keys off [id] when supplied (falls back to
  /// [name]). Pass the OrderLine id here in real screens.
  final String? id;
  final String? sku;
  final String? meta;
  final num qty;
  final num unitPrice;

  /// The line total, computed by the backend and rendered as-is. NOT derived
  /// from qty/unitPrice here (AD-10/16).
  final num amount;
  final bool editable;

  /// Display-only badge (e.g. "linh động"/"dự kiến") — never affects price.
  final String? flag;
  final bool zebra;
  final ValueChanged<num>? onQtyChange;
  final ValueChanged<num>? onUnitPriceChange;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final row = Container(
      color: zebra ? _zebraFill : null,
      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 9.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(flex: 3, child: _nameCell()),
          Expanded(
            flex: 2,
            child: _numberCell(
              value: qty,
              editable: editable,
              semanticsLabel: 'Số lượng',
              onChanged: onQtyChange,
            ),
          ),
          Expanded(
            flex: 2,
            child: _numberCell(
              value: unitPrice,
              editable: editable,
              semanticsLabel: 'Đơn giá',
              onChanged: onUnitPriceChange,
            ),
          ),
          Expanded(flex: 2, child: _amountCell()),
          if (onDelete != null)
            Padding(
              padding: const EdgeInsets.only(left: 8.0),
              child: AppButton(
                icon: 'ic-trash',
                variant: AppButtonVariant.ghost,
                size: AppButtonSize.sm,
                onPressed: onDelete,
              ),
            ),
        ],
      ),
    );

    // Mobile swipe-to-delete (the web-deferred parity point, UX-DR-24). Only
    // emits intent via onDelete — the screen removes the line and re-queries.
    if (onDelete == null) return row;
    return Dismissible(
      key: ValueKey('cart-line-${id ?? name}'),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => onDelete!(),
      background: Container(
        alignment: Alignment.centerRight,
        color: AppTokens.danger,
        padding: const EdgeInsets.symmetric(horizontal: 16.0),
        child: const AppIcon('ic-trash', size: 18.0, color: AppTokens.surface),
      ),
      child: row,
    );
  }

  Widget _nameCell() {
    final sub = sku ?? meta;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          name,
          style: const TextStyle(
            color: AppTokens.ink,
            fontFamily: AppTokens.fontFamily,
            fontSize: 12.5,
            fontWeight: FontWeight.w800,
          ),
        ),
        if (sub != null) _microMuted(sub),
        if (flag != null) _microMuted(flag!),
      ],
    );
  }

  Widget _microMuted(String text) {
    return Text(
      text,
      style: const TextStyle(
        color: AppTokens.muted,
        fontFamily: AppTokens.fontFamily,
        fontSize: 10.0,
        fontWeight: FontWeight.w600,
      ),
    );
  }

  Widget _numberCell({
    required num value,
    required bool editable,
    required String semanticsLabel,
    required ValueChanged<num>? onChanged,
  }) {
    if (editable) {
      return AppField(
        value: '$value',
        semanticsLabel: semanticsLabel,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        onChanged: (text) => onChanged?.call(num.tryParse(text) ?? 0),
      );
    }
    return Align(
      alignment: Alignment.centerRight,
      child: Text(
        '$value',
        style: const TextStyle(
          color: AppTokens.ink2,
          fontFamily: AppTokens.fontFamily,
          fontSize: 12.5,
          fontFeatures: [FontFeature.tabularFigures()],
        ),
      ),
    );
  }

  Widget _amountCell() {
    return Align(
      alignment: Alignment.centerRight,
      // Rendered STRAIGHT from the backend-computed prop — no arithmetic.
      child: Text(
        '$amount',
        style: const TextStyle(
          color: AppTokens.ink,
          fontFamily: AppTokens.fontFamily,
          fontSize: 12.5,
          fontWeight: FontWeight.w800,
          fontFeatures: [FontFeature.tabularFigures()],
        ),
      ),
    );
  }
}
