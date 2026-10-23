// hand-authored — Flutter design-system component (Story 8.1, mirror web
// BarChart.tsx — `.chart*` in components.css). Column chart of COUNTS; 120px
// tall like the phone frame of the mockup.

import 'package:flutter/widgets.dart';

import '../tokens/app_tokens.dart';

class AppBarChartItem {
  const AppBarChartItem({required this.label, required this.value});

  final String label;
  final int value;
}

/// Column chart of counts (never money — money is not scaled or compared on
/// the client, AD-2). Each column is scaled against the largest value; the
/// count sits above the column and the label below it. All zeros ⇒ every
/// column at the minimum height, no division.
class AppBarChart extends StatelessWidget {
  const AppBarChart({super.key, required this.items, this.height = 120.0});

  final List<AppBarChartItem> items;

  /// Height of the column area (count line included), labels excluded.
  final double height;

  /// Lowest column height (%), so a zero still shows where its column is.
  static const int minBarPercent = 2;

  /// Count text (10px × 1.2 line height) + the 2px gap above the column.
  static const double _countLine = 14.0;

  /// Column height in percent of the tallest one.
  static int barPercent(int value, int maxValue) {
    if (maxValue == 0) return minBarPercent;
    final pct = (value * 100 / maxValue).round();
    return pct < minBarPercent ? minBarPercent : pct;
  }

  @override
  Widget build(BuildContext context) {
    final maxValue = items.fold<int>(0, (m, i) => i.value > m ? i.value : m);
    final barArea = height - _countLine;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final item in items)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3.0),
              child: Column(
                children: [
                  SizedBox(
                    height: height,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(
                          '${item.value}',
                          maxLines: 1,
                          softWrap: false,
                          overflow: TextOverflow.visible,
                          style: const TextStyle(
                            color: AppTokens.ink2,
                            fontFamily: AppTokens.fontFamily,
                            fontSize: 10.0,
                            fontWeight: FontWeight.w800,
                            height: 1.2,
                          ),
                        ),
                        const SizedBox(height: 2.0),
                        Container(
                          height:
                              barArea * barPercent(item.value, maxValue) / 100,
                          decoration: const BoxDecoration(
                            color: AppTokens.teal,
                            borderRadius: BorderRadius.vertical(
                              top: Radius.circular(5.0),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 5.0),
                  Text(
                    item.label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppTokens.muted,
                      fontFamily: AppTokens.fontFamily,
                      fontSize: 9.5,
                      fontWeight: FontWeight.w700,
                      height: 1.2,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
