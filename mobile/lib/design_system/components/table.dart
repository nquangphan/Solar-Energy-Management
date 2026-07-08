// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.5
// Table.tsx — `.table*` in components.css lines 97-105). A structural wrapper:
// the screen supplies columns + rows; the widget owns the dense header, 1px
// cell borders, last-row-borderless rule, right-aligned num column, and zebra
// tint. Flat (Viền nét) — borders only, no elevation.

import 'package:flutter/widgets.dart';

import '../tokens/app_tokens.dart';

/// The `#F7FBFA` zebra fill — a canonical component constant (not a token).
const Color _zebraFill = Color(0xFFF7FBFA);

/// A column definition: header [label], numeric right-alignment, and [flex].
class AppTableColumn {
  const AppTableColumn(this.label, {this.numeric = false, this.flex = 1});
  final String label;
  final bool numeric;
  final int flex;
}

/// A data row: one widget per column, plus optional zebra tint. Cell widgets
/// are supplied by the screen (use [AppTableCellText] for standard cells).
class AppTableRow {
  const AppTableRow(this.cells, {this.zebra = false});
  final List<Widget> cells;
  final bool zebra;
}

class AppTable extends StatelessWidget {
  const AppTable({super.key, required this.columns, required this.rows});

  final List<AppTableColumn> columns;
  final List<AppTableRow> rows;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _headerRow(),
        for (var i = 0; i < rows.length; i++)
          _dataRow(rows[i], last: i == rows.length - 1),
      ],
    );
  }

  Widget _headerRow() {
    return Container(
      decoration: const BoxDecoration(
        color: AppTokens.surface2,
        border: Border(
          bottom:
              BorderSide(color: AppTokens.line, width: AppTokens.borderWidth),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
      child: Row(
        children: [
          for (final col in columns)
            Expanded(
              flex: col.flex,
              child: Align(
                alignment:
                    col.numeric ? Alignment.centerRight : Alignment.centerLeft,
                child: Text(
                  col.label.toUpperCase(),
                  style: const TextStyle(
                    color: AppTokens.muted,
                    fontFamily: AppTokens.fontFamily,
                    fontSize: 10.0,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.05 * 10.0,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _dataRow(AppTableRow row, {required bool last}) {
    return Container(
      decoration: BoxDecoration(
        color: row.zebra ? _zebraFill : null,
        border: last
            ? null
            : const Border(
                bottom: BorderSide(color: AppTokens.line, width: 1.0),
              ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 9.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          for (var i = 0; i < columns.length; i++)
            Expanded(
              flex: columns[i].flex,
              child: Align(
                alignment: columns[i].numeric
                    ? Alignment.centerRight
                    : Alignment.centerLeft,
                child: i < row.cells.length
                    ? row.cells[i]
                    : const SizedBox.shrink(),
              ),
            ),
        ],
      ),
    );
  }
}

/// Standard table cell text (`.table td`, `.strong` when [strong]). 12.5px,
/// `ink2` body / `ink` w800 when strong.
class AppTableCellText extends StatelessWidget {
  const AppTableCellText(this.text, {super.key, this.strong = false});

  final String text;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        color: strong ? AppTokens.ink : AppTokens.ink2,
        fontFamily: AppTokens.fontFamily,
        fontSize: 12.5,
        fontWeight: strong ? FontWeight.w800 : FontWeight.w400,
      ),
    );
  }
}
