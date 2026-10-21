// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.6
// CartLineRow.tsx). A single editable cart line.
//
// MONEY INVARIANT (AD-10/16) — THE most important guard in this story:
// `amount` is a number the BACKEND computed (POST /orders/preview-total) and is
// taken STRAIGHT from the prop. This widget never computes money (no quantity ×
// unit price, no sum); it displays via formatVnd (MoneyText). The unit-price
// INPUT keeps raw digits for typing. Edits only emit the new number via
// onQtyChange/onUnitPriceChange; the SCREEN re-queries preview-total and passes
// a fresh `amount` back. A runtime test (amount independent of qty/price) plus a
// source-guard enforce this.

import 'package:flutter/widgets.dart';

import '../icons/app_icons.dart';
import '../tokens/app_tokens.dart';
import 'button.dart';
import 'field.dart';
import 'money_text.dart';

const Color _zebraFill = Color(0xFFF7FBFA);

/// How the warranty cell renders for this line (Story 4.9), mirror of the web
/// `WarrantyMode` union: `input` (numeric months), `none` ("Không có", no input),
/// `link` (a "+ Thêm bảo hành" control that reveals the input).
enum AppWarrantyMode { input, none, link }

/// Stock hint under the line name (quote early warning), mirror of the web
/// `CartLineStockHint`. Display only — the label is built by the SCREEN from
/// backend figures, [short] picks the tone. It never affects money and never
/// blocks anything.
class AppCartLineStockHint {
  const AppCartLineStockHint({required this.label, required this.short});

  final String label;
  final bool short;
}

/// Format a warranty duration for display: whole years as "X năm", else "X
/// tháng", `null` as empty. SAME rule as the backend `formatWarranty` and the web
/// twin `formatWarrantyMonths` — one rule in three places, pinned by parity.
///
/// ⚠️ MUST use integer division `~/`: `60 / 12` is `5.0` (double) → "5.0 năm".
/// `%`/`~/` are TIME-UNIT math, not money — they do not touch the money invariant.
String formatWarrantyMonths(int? months) {
  if (months == null) return '';
  return months % 12 == 0 ? '${months ~/ 12} năm' : '$months tháng';
}

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
    this.priceEditable,
    this.warrantyMonths,
    this.warrantyMode = AppWarrantyMode.input,
    this.warrantyEditable,
    this.onWarrantyChange,
    this.flag,
    this.stockHint,
    this.zebra = false,
    this.onQtyChange,
    this.onUnitPriceChange,
    this.onDelete,
  }) : assert(
          onDelete == null || id != null,
          'Provide a stable [id] when [onDelete] is set: two lines with the same '
          'name would otherwise share a Dismissible key and crash on swipe.',
        );

  final String name;

  /// Stable line identity for the swipe key. A cart may hold two lines with the
  /// same [name], so the Dismissible keys off [id] when supplied (falls back to
  /// [name]). Pass the OrderLine id here in real screens.
  final String? id;
  final String? sku;
  final String? meta;
  final num qty;

  /// Integer đồng (AD-10). Read-only it displays via [MoneyText]; editable it is
  /// a raw-digit input.
  final int unitPrice;

  /// The line total, computed by the backend and displayed via [MoneyText].
  /// NOT derived from qty/unitPrice here (AD-10/16).
  final int amount;
  final bool editable;

  /// Gate the UNIT-PRICE input separately from qty (Story 4.1): qty is editable
  /// on every line of a draft quote, but the price only when the line allows it
  /// (free line / Product.priceEditable). Null = follow [editable] so pre-4.1
  /// callers keep their behavior.
  final bool? priceEditable;

  /// Warranty column (Story 4.9). [warrantyMode] is derived by the SCREEN from
  /// the line type; [warrantyEditable] gates the input vs read-only text (draft +
  /// permission). Empty input commits `null` (= clear warranty).
  final int? warrantyMonths;
  final AppWarrantyMode warrantyMode;
  final bool? warrantyEditable;
  final ValueChanged<int?>? onWarrantyChange;

  /// Display-only badge (e.g. "linh động"/"dự kiến") — never affects price.
  final String? flag;

  /// Quote stock hint under the name ("Kho còn N" / "Cần nhập N").
  final AppCartLineStockHint? stockHint;
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
            child: _WarrantyCell(
              months: warrantyMonths,
              mode: warrantyMode,
              editable: (warrantyEditable ?? false) &&
                  warrantyMode != AppWarrantyMode.none,
              onChanged: onWarrantyChange,
            ),
          ),
          Expanded(
            flex: 2,
            child: (priceEditable ?? editable)
                ? _numberCell(
                    value: unitPrice,
                    editable: true,
                    semanticsLabel: 'Đơn giá',
                    onChanged: onUnitPriceChange,
                  )
                : Align(
                    alignment: Alignment.centerRight,
                    child: MoneyText(
                      unitPrice,
                      style: const TextStyle(
                        color: AppTokens.ink2,
                        fontFamily: AppTokens.fontFamily,
                        fontSize: 12.5,
                      ),
                    ),
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
        if (stockHint != null)
          Text(
            stockHint!.label,
            style: TextStyle(
              color: stockHint!.short ? AppTokens.danger : AppTokens.ok,
              fontFamily: AppTokens.fontFamily,
              fontSize: 11.0,
              fontWeight: FontWeight.w700,
            ),
          ),
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
      // The backend-computed prop, displayed via formatVnd — no arithmetic.
      child: MoneyText(
        amount,
        style: const TextStyle(
          color: AppTokens.ink,
          fontFamily: AppTokens.fontFamily,
          fontSize: 12.5,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

/// The warranty cell (Story 4.9). Stateful for the two local behaviours the web
/// twin also keeps component-local: the commit-on-blur draft, and the 'link'
/// reveal ("+ Thêm bảo hành" → input). Empty input commits `null` (= clear).
class _WarrantyCell extends StatefulWidget {
  const _WarrantyCell({
    required this.months,
    required this.mode,
    required this.editable,
    required this.onChanged,
  });

  final int? months;
  final AppWarrantyMode mode;
  final bool editable;
  final ValueChanged<int?>? onChanged;

  @override
  State<_WarrantyCell> createState() => _WarrantyCellState();
}

class _WarrantyCellState extends State<_WarrantyCell> {
  late final TextEditingController _ctl =
      TextEditingController(text: widget.months?.toString() ?? '');
  bool _revealed = false;

  @override
  void didUpdateWidget(_WarrantyCell old) {
    super.didUpdateWidget(old);
    // Controlled parity: reflect an externally-pushed value (e.g. after refresh),
    // but never fight the user mid-typing (same guard as AppField).
    final String next = widget.months?.toString() ?? '';
    if (widget.months != old.months && next != _ctl.text) {
      _ctl.text = next;
      _ctl.selection = TextSelection.collapsed(offset: next.length);
    }
  }

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  void _commit() {
    final String trimmed = _ctl.text.trim();
    if (trimmed.isEmpty) {
      widget.onChanged?.call(null);
      return;
    }
    final int? n = int.tryParse(trimmed);
    if (n != null && n >= 1) widget.onChanged?.call(n);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.mode == AppWarrantyMode.none) {
      return Align(alignment: Alignment.centerRight, child: _microMuted('Không có'));
    }
    if (!widget.editable) {
      return Align(
        alignment: Alignment.centerRight,
        child: Text(
          formatWarrantyMonths(widget.months),
          style: const TextStyle(
            color: AppTokens.ink2,
            fontFamily: AppTokens.fontFamily,
            fontSize: 12.5,
            fontFeatures: [FontFeature.tabularFigures()],
          ),
        ),
      );
    }
    if (widget.mode == AppWarrantyMode.link && !_revealed) {
      return Align(
        alignment: Alignment.centerRight,
        child: AppButton(
          label: '+ Thêm bảo hành',
          variant: AppButtonVariant.ghost,
          size: AppButtonSize.sm,
          onPressed: () => setState(() => _revealed = true),
        ),
      );
    }
    return Focus(
      onFocusChange: (bool has) {
        if (!has) _commit();
      },
      child: AppField(
        controller: _ctl,
        semanticsLabel: 'Bảo hành (tháng)',
        keyboardType: const TextInputType.numberWithOptions(),
      ),
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
}
