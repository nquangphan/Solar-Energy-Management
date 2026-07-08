// hand-authored — Flutter app-shell widget (Story 1.8, mirror mockup
// all-screens.html `.phone` CSS 260-266). The device chrome around a mobile
// screen: a dark body, a clipped glass, a notch and a fake status bar. Flat
// (Viền nét) — the dark body/notch use canonical shell literals absent from
// AppTokens (`#0C1512`), mirrored from the mockup.
//
// Width is fixed at 330 but wrapped in Center/SizedBox so it never blocks the
// caller's responsive layout — a caller may drop it in a scroll view.

import 'package:flutter/widgets.dart';

import '../tokens/app_tokens.dart';

/// Dark device body colour (`.phone`/`.notch`, `#0C1512`). A canonical shell
/// literal — not a design token.
const Color _body = Color(0xFF0C1512);

/// Phone device frame: a 330px dark body wrapping a 700px glass that clips its
/// [child], with a centred notch and a fake status bar ([time] / [status]).
class AppPhoneFrame extends StatelessWidget {
  const AppPhoneFrame({
    super.key,
    required this.child,
    this.time = '9:41',
    this.status = '5G · 82%',
  });

  /// Content below the status bar inside the glass — typically an
  /// `AppMobileShell`.
  final Widget child;
  final String time;
  final String status;

  @override
  Widget build(BuildContext context) {
    final glass = ClipRRect(
      borderRadius: BorderRadius.circular(32.0),
      child: Container(
        height: 700.0,
        color: AppTokens.surface,
        child: Column(
          children: [
            _statusBar(),
            Expanded(child: child),
          ],
        ),
      ),
    );

    return Center(
      child: SizedBox(
        width: 330.0,
        child: Container(
          padding: const EdgeInsets.all(9.0),
          decoration: BoxDecoration(
            color: _body,
            borderRadius: BorderRadius.circular(40.0),
          ),
          // Notch overlaps the clipped glass: glass below, notch Positioned on
          // top so the 32px clip never eats its rounded lower corners.
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              glass,
              Positioned(
                top: 0.0,
                left: 0.0,
                right: 0.0,
                child: Center(
                  child: Container(
                    width: 116.0,
                    height: 22.0,
                    decoration: const BoxDecoration(
                      color: _body,
                      borderRadius: BorderRadius.only(
                        bottomLeft: Radius.circular(14.0),
                        bottomRight: Radius.circular(14.0),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _statusBar() {
    return Container(
      height: 34.0,
      padding: const EdgeInsets.symmetric(horizontal: 18.0),
      alignment: Alignment.center,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            time,
            style: const TextStyle(
              color: AppTokens.ink,
              fontFamily: AppTokens.fontFamily,
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            status,
            style: const TextStyle(
              color: AppTokens.ink,
              fontFamily: AppTokens.fontFamily,
              fontSize: 10.0,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
