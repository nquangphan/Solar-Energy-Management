// hand-authored — Flutter app-screen (Story 5.9, mobile twin of web
// web/src/screens/warranty/WarrantyLookupScreen.tsx). Tra cứu bảo hành: the
// staffer types the phone number of the customer who is ON THE LINE, and gets
// back which items of which orders are still under warranty.
//
// EVERYTHING NUMERIC ARRIVES COMPUTED (QĐ-4, AD-2). The screen does no date
// arithmetic and never derives a status: `warrantyEndAt`, `remainingDays`,
// `remainingMonths` and `warrantyStatus` all come from the backend, which owns
// the single implementation of "start + N months". A `switch` over
// `warrantyStatus` is the CORRECT shape here — mapping a server answer to a
// colour and a label.
//
// It never normalises the phone either (AD-9): the raw string goes out as typed.
//
// READ-ONLY (FR-36, Phase 1): no warranty claim, no lifecycle, no reminder. The
// screen shows the state `sap_het`; it does not notify anyone about it.
//
// LABELS are byte-identical with the web twin (UX-DR-27).

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/warranty_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import '../customers/customer_pick_screen.dart' show kMenuTabIndex;

/// `2038-02-10T00:00:00Z` ⇒ `10/02/2038` — twin of `formatNgay()` in
/// web/src/screens/warranty/format-ngay.ts, pinned by parity.test.mjs.
///
/// A STRING SLICE of the UTC ISO form, not date arithmetic (QĐ-4): mobile ships
/// no date library, and `warrantyEndAt` arrives at `00:00:00Z`, so taking
/// `YYYY-MM-DD` off its UTC form cannot shift the day the way a device-local
/// reading (UTC+7) would. Never call `toLocal()` here.
String dinhDangNgay(DateTime? d) {
  if (d == null) return '—';
  final String phanNgay = d.toUtc().toIso8601String().substring(0, 10);
  if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(phanNgay)) return '—';
  return '${phanNgay.substring(8, 10)}/${phanNgay.substring(5, 7)}/${phanNgay.substring(0, 4)}';
}

enum _LoadState { idle, loading, ready, error }

class WarrantyLookupScreen extends StatefulWidget {
  const WarrantyLookupScreen({super.key, required this.port});

  final WarrantyPort port;

  @override
  State<WarrantyLookupScreen> createState() => _WarrantyLookupScreenState();
}

class _WarrantyLookupScreenState extends State<WarrantyLookupScreen> {
  final TextEditingController _sdt = TextEditingController();

  _LoadState _state = _LoadState.idle;
  WarrantyLookup? _ketQua;
  String _loi = '';

  @override
  void dispose() {
    _sdt.dispose();
    super.dispose();
  }

  Future<void> _tra() async {
    setState(() => _state = _LoadState.loading);
    try {
      // The RAW string, exactly as typed — the backend owns the only normaliser.
      final WarrantyLookup kq = await widget.port.lookup(_sdt.text);
      if (!mounted) return;
      setState(() {
        _ketQua = kq;
        _state = _LoadState.ready;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        // The backend's own words, verbatim: the client owns no rule about what
        // a valid phone is, so it owns no wording for one either.
        _loi = err is WarrantyPortException
            ? err.message
            : 'Không tra cứu được bảo hành.';
        _state = _LoadState.error;
      });
    }
  }

  /// How much is left, in the largest unit that still says something true.
  ///
  /// `formatWarrantyMonths` prints ONE unit and treats 0 as "0 năm" — so a line
  /// with three weeks left, which is exactly the line the staffer is on the
  /// phone about, would read "Còn 0 năm". Below a whole month the sentence
  /// switches to the day count the backend already sent. NO arithmetic happens
  /// here: every number is picked, never computed (QĐ-4).
  ///
  /// TWIN of `conLai()` in the web screen — the wording is byte-identical on
  /// both platforms and pinned by parity.test.mjs.
  String _conLai(WarrantyLine line) {
    if (line.remainingMonths >= 1) {
      return 'Còn ${formatWarrantyMonths(line.remainingMonths.toInt())}';
    }
    if (line.remainingDays > 0) return 'Còn ${line.remainingDays} ngày';
    // `remainingDays == 0` is the expiry day itself, and the line IS still
    // covered — "Còn 0 ngày" would read as expired.
    return 'Hết hạn hôm nay';
  }

  /// Chip colour + label per status. `het_han` renders a FIXED string: a duration
  /// formatter has no sensible output for an expired line, and the mockup itself
  /// only prints "Hết hạn". A status this build does not know (`$unknown`, the
  /// backend added one) gets the sentence in a neutral colour — never a crash.
  Widget _chipTrangThai(WarrantyLine line) {
    late final String label;
    late final Color mau;
    // The generated enum's wire value: the same three literals as the web twin,
    // and `$unknown` (json == null) lands in the neutral default.
    switch (line.warrantyStatus.json) {
      case 'het_han':
        label = 'Hết hạn';
        mau = AppTokens.danger;
      case 'sap_het':
        label = _conLai(line);
        mau = AppTokens.warn;
      case 'con_han':
        // Same sentence as `sap_het` — the two differ only in colour, which is
        // why the colour is read from the status and never guessed from numbers.
        label = _conLai(line);
        mau = AppTokens.ok;
      default:
        label = _conLai(line);
        mau = AppTokens.muted;
    }
    return AppChip(
      label: label,
      background: AppTokens.surface,
      foreground: mau,
      border: mau,
    );
  }

  Widget _bangDon(WarrantyOrder don) {
    return Padding(
      padding: const EdgeInsets.only(top: AppTokens.space12),
      child: AppFrame(
        label: 'Đơn ${don.id} · chốt ${dinhDangNgay(don.confirmedAt)}',
        // TWO columns, not five like the web twin: a phone row shows the item and
        // its verdict; the duration and the expiry date ride along as the item's
        // meta line (mockup). Squeezing five columns into 320pt would clip the
        // pill — the one thing the staffer actually reads out to the customer.
        child: AppTable(
          columns: const <AppTableColumn>[
            AppTableColumn('Vật tư', flex: 3),
            AppTableColumn('Còn lại', flex: 2),
          ],
          rows: <AppTableRow>[
            for (final WarrantyLine line in don.lineItems)
              AppTableRow(<Widget>[
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    AppTableCellText('${line.name} ×${line.qty}', strong: true),
                    AppTableCellText(
                      '${formatWarrantyMonths(line.warrantyMonths.toInt())} · đến ${dinhDangNgay(line.warrantyEndAt)}',
                    ),
                  ],
                ),
                // The label is a SENTENCE the backend supplied the numbers for
                // ("Còn 138 tháng"), so its width is not something this screen
                // controls. Scaling it down beats clipping the one string the
                // staffer reads out loud — and beats shortening the wording,
                // which would fork the labels away from the web twin.
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerRight,
                  child: _chipTrangThai(line),
                ),
              ]),
          ],
        ),
      ),
    );
  }

  Widget _than() {
    final WarrantyLookup? kq = _ketQua;
    switch (_state) {
      case _LoadState.idle:
        return const AppEmptyState(
          icon: 'ic-phone',
          title: 'Nhập số điện thoại khách để tra cứu bảo hành.',
        );
      case _LoadState.loading:
        return const AppSkeleton();
      case _LoadState.error:
        return AppErrorState(message: _loi, onRetry: _tra);
      case _LoadState.ready:
        if (kq == null || !kq.found) {
          return const AppEmptyState(
            icon: 'ic-phone',
            title: 'SĐT chưa có trong hệ thống.',
          );
        }
        if (kq.orders.isEmpty) {
          return const AppEmptyState(
            icon: 'ic-phone',
            title: 'Khách này chưa có vật tư nào còn theo dõi bảo hành.',
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            AppCard(
              variant: AppCardVariant.teal,
              padding: const EdgeInsets.all(AppTokens.space16),
              child: Text(
                '${kq.customer!.name} · ${kq.phone}',
                style: const TextStyle(
                  color: AppTokens.ink,
                  fontFamily: AppTokens.fontFamily,
                  fontSize: 13.0,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            for (final WarrantyOrder don in kq.orders) _bangDon(don),
          ],
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: const AppTopbar(
          eyebrow: 'HỖ TRỢ KHÁCH',
          title: 'Tra cứu bảo hành',
        ),
        // Reached from the Menu tab (mockup) — warranty lookup is occasional desk
        // work, not one of the four primary tabs.
        bottomNav: const AppBottomNav(activeIndex: kMenuTabIndex),
        body: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              AppField(
                label: 'SĐT khách',
                size: AppFieldSize.large,
                controller: _sdt,
                placeholder: '0903 176 968',
              ),
              const SizedBox(height: AppTokens.space12),
              AppButton(
                variant: AppButtonVariant.primary,
                label: 'Tra cứu',
                wide: true,
                onPressed: _tra,
              ),
              const SizedBox(height: AppTokens.space16),
              _than(),
            ],
          ),
        ),
      ),
    );
  }
}
