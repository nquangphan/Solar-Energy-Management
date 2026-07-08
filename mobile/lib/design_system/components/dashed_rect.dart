// hand-authored — internal helper for the design-system component layer
// (Story 1.7). Flutter has no `border-style: dashed`, so the two dashed
// surfaces in the spec (stepper `gate` node, `.thumb.add` upload tile) draw
// their outline with this painter instead of a decorative effect. This keeps
// the "Viền nét" rule intact: a finite 1.5px stroke, never a BoxShadow.
//
// YAGNI: a CustomPainter is lighter than pulling in a `dotted_border` package
// for only two call sites (Open Question 2 — resolved to CustomPainter).

import 'package:flutter/widgets.dart';

/// Paints a dashed rounded-rectangle outline. Used for the stepper `gate` node
/// (a dashed circle) and the upload add-tile (a dashed rounded square).
class DashedRectPainter extends CustomPainter {
  const DashedRectPainter({
    required this.color,
    this.strokeWidth = 1.5,
    this.radius = 0,
    this.dash = 3,
    this.gap = 2.5,
  });

  final Color color;
  final double strokeWidth;
  final double radius;
  final double dash;
  final double gap;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;

    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);
    canvas.drawPath(_dash(path), paint);
  }

  // Walks the path and emits only the "on" dash segments.
  Path _dash(Path source) {
    final dashed = Path();
    for (final metric in source.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final next = distance + dash;
        dashed.addPath(
          metric.extractPath(distance, next.clamp(0, metric.length)),
          Offset.zero,
        );
        distance = next + gap;
      }
    }
    return dashed;
  }

  @override
  bool shouldRepaint(DashedRectPainter old) =>
      old.color != color ||
      old.strokeWidth != strokeWidth ||
      old.radius != radius ||
      old.dash != dash ||
      old.gap != gap;
}
