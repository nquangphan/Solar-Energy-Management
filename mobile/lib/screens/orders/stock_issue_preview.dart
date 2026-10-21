// hand-authored — the order's stock-out preview, shared by the
// status-change screen (step "Đã giao") and the order detail screen ("Phiếu
// xuất"). Mobile twin of web `stock-issue-preview.tsx`; labels byte-identical.
//
// THE CLIENT DECIDES NOTHING (AD-2). Rows arrive already summed per product and
// in the backend's canonical order; "Tồn thật" is shown for counting, never
// compared with "Đơn cần" here — whether the stock is enough is the backend's
// answer (409 with `lines.{i}.qty`), which this block places under row `i`.

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/orders_port.dart';
import '../../design_system/tokens/app_tokens.dart';

/// Row index → the backend's message, from `fieldErrors` keys `lines.{i}.qty`.
Map<int, String> rowErrors(Object error) {
  if (error is! OrderPortException) return const <int, String>{};
  final RegExp linePath = RegExp(r'^lines\.(\d+)\.qty$');
  return <int, String>{
    for (final MapEntry<String, String> fe in error.fieldErrors.entries)
      if (linePath.firstMatch(fe.key) != null)
        int.parse(linePath.firstMatch(fe.key)!.group(1)!): fe.value,
  };
}

const TextStyle _kMicroMuted = TextStyle(
  color: AppTokens.muted,
  fontFamily: AppTokens.fontFamily,
  fontSize: AppTokens.microFontSize,
  fontWeight: FontWeight.w700,
);

const TextStyle _kRowError = TextStyle(
  color: AppTokens.danger,
  fontFamily: AppTokens.fontFamily,
  fontSize: AppTokens.microFontSize,
  fontWeight: FontWeight.w700,
);

const TextStyle _kNote = TextStyle(
  color: AppTokens.ink,
  fontFamily: AppTokens.fontFamily,
  fontSize: 13.0,
  fontWeight: FontWeight.w600,
);

class StockIssuePreview extends StatelessWidget {
  const StockIssuePreview({
    super.key,
    required this.view,
    this.errors = const <int, String>{},
  });

  final OrderStockIssueView view;
  final Map<int, String> errors;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        const AppBanner(
          tone: AppBannerTone.info,
          child: Text.rich(
            TextSpan(
              style: _kNote,
              children: <InlineSpan>[
                TextSpan(text: 'Đây là '),
                TextSpan(
                  text: 'lần duy nhất',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                TextSpan(
                  text:
                      ' đơn này trừ tồn kho. Một Đơn — một phiếu xuất. Đếm hàng thực tế trước khi xác nhận.',
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppTokens.space8),
        AppTable(
          columns: const <AppTableColumn>[
            AppTableColumn('Sản phẩm', flex: 3),
            AppTableColumn('Đơn cần', numeric: true, flex: 1),
            AppTableColumn('Tồn thật', numeric: true, flex: 1),
          ],
          rows: <AppTableRow>[
            for (int i = 0; i < view.lines.length; i++)
              AppTableRow(<Widget>[
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    AppTableCellText(view.lines[i].name),
                    if (errors[i] != null) Text(errors[i]!, style: _kRowError),
                  ],
                ),
                AppTableCellText('${view.lines[i].qty}'),
                AppTableCellText('${view.lines[i].onHand}'),
              ]),
          ],
        ),
        for (final String name in view.untrackedItems)
          Padding(
            padding: const EdgeInsets.only(top: AppTokens.space4),
            child: Text.rich(
              TextSpan(
                style: _kMicroMuted,
                children: <InlineSpan>[
                  TextSpan(text: '$name · '),
                  const TextSpan(
                    text: 'Không theo kho — không có trong phiếu xuất',
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
