// hand-authored — Flutter app-screen (Story 8.5, mobile twin of web
// web/src/screens/audit/AuditLogScreen.tsx). Audit log, opened from Menu: one
// card per record — who, action, when; then target · before → after — newest
// first, with a target-type filter, a Vietnam-day range and paging.
//
// READ ONLY (AD-8): no edit, no delete, no export. The action label and the flat
// before → after rows arrive computed by the backend (AD-2); this screen only
// picks how to print a value (money formatter, status label, raw text).
//
// LABELS are byte-identical with the web twin. AuditLogCubit reads through the
// injected [AuditLogsPort]; the screen only renders its state and forwards taps.
// The two date controllers stay here, in the State. A date field filters only
// once it holds a real `YYYY-MM-DD` day (or is emptied): while it is being typed
// the last applied range stays. The web twin uses a native date input, which
// never exposes a half-typed value.

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/audit_logs_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_tabs.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import '../customers/customer_pick_screen.dart' show kMenuTabIndex;
import '../inventory/stock_vouchers_screen.dart' show ngayGio;
import 'audit_log_cubit.dart';
import 'audit_log_state.dart';

/// Vietnamese label of every target type the backend publishes, keyed by its
/// contract value. TWIN of `AUDIT_TARGET_LABELS` in the web screen.
const Map<String, String> kAuditTargetLabels = <String, String>{
  'Order': 'Đơn hàng',
  'Account': 'Account',
  'Product': 'Sản phẩm',
  'ProductGroup': 'Nhóm sản phẩm',
  'Customer': 'Khách hàng',
  'CustomerSource': 'Nguồn khách',
  'StockVoucher': 'Phiếu kho',
  'FeatureFlag': 'Cờ tính năng',
  'SystemSetting': 'Cấu hình',
};

const String _kAll = 'ALL';

final List<AppTabItem> _kFilterTabs = <AppTabItem>[
  const AppTabItem(key: _kAll, label: 'Tất cả'),
  for (final MapEntry<String, String> e in kAuditTargetLabels.entries)
    AppTabItem(key: e.key, label: e.value),
];

final RegExp _integer = RegExp(r'^-?\d+$');
final RegExp _uuid = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  caseSensitive: false,
);

/// A UUID is cut to its first 8 characters; anything else (a phone key) is shown whole.
String _shortId(String id) => _uuid.hasMatch(id) ? id.substring(0, 8) : id;

/// Prints one side of a change: money through the formatter, a status through its label, else as sent.
String _renderValue(AuditChange change, String? value) {
  if (value == null) return '—';
  if (change.isMoney && _integer.hasMatch(value)) {
    final int? amount = int.tryParse(value);
    if (amount != null) return formatVnd(amount);
  }
  if (change.field == 'status') {
    final StatusKey? key = statusKeyOf(value);
    if (key != null) return kStatusLabels[key]!;
  }
  return value;
}

String _actorText(AuditLogEntry entry) {
  final String? actor = entry.actorAccountId;
  if (actor == null) return 'Hệ thống';
  return entry.actorDisplayName ?? _shortId(actor);
}

String _targetText(AuditLogEntry entry) {
  final String? id = entry.targetId;
  // A type newer than this build decodes to `$unknown` (no json): keep the id.
  final String? type = entry.targetType?.json;
  if (type == null) return id == null ? '—' : _shortId(id);
  final String label = kAuditTargetLabels[type] ?? type;
  return id == null ? label : '$label ${_shortId(id)}';
}

class AuditLogScreen extends StatefulWidget {
  const AuditLogScreen({super.key, required this.port});

  final AuditLogsPort port;

  @override
  State<AuditLogScreen> createState() => _AuditLogScreenState();
}

class _AuditLogScreenState extends State<AuditLogScreen> {
  late final AuditLogCubit _cubit = AuditLogCubit(widget.port)..load();
  final TextEditingController _from = TextEditingController();
  final TextEditingController _to = TextEditingController();

  @override
  void dispose() {
    _from.dispose();
    _to.dispose();
    _cubit.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: BlocBuilder<AuditLogCubit, AuditLogState>(builder: _view),
    );
  }

  Widget _view(BuildContext context, AuditLogState state) {
    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: const AppTopbar(eyebrow: 'QUẢN TRỊ', title: 'Audit log'),
        bottomNav: const AppBottomNav(activeIndex: kMenuTabIndex),
        body: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              const AppBanner(
                tone: AppBannerTone.info,
                icon: 'ic-audit',
                message: 'Bản ghi bất biến — chỉ đọc, không sửa/xoá.',
              ),
              const SizedBox(height: AppTokens.space12),
              AppTabs(
                tabs: _kFilterTabs,
                activeKey: state.targetType?.json ?? _kAll,
                onSelect: (String key) => _cubit.selectTarget(
                  key == _kAll ? null : AuditTargetType.fromJson(key),
                ),
              ),
              const SizedBox(height: AppTokens.space12),
              AppField(
                label: 'Từ ngày',
                placeholder: 'YYYY-MM-DD',
                controller: _from,
                keyboardType: TextInputType.datetime,
                onChanged: _cubit.setFrom,
              ),
              const SizedBox(height: AppTokens.space8),
              AppField(
                label: 'Đến ngày',
                placeholder: 'YYYY-MM-DD',
                controller: _to,
                keyboardType: TextInputType.datetime,
                onChanged: _cubit.setTo,
              ),
              const SizedBox(height: AppTokens.space12),
              _body(state),
            ],
          ),
        ),
      ),
    );
  }

  Widget _body(AuditLogState state) {
    switch (state.status) {
      case AuditLogStatus.loading:
        return const Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            AppSkeleton(height: 64),
            SizedBox(height: AppTokens.space8),
            AppSkeleton(height: 64),
          ],
        );
      case AuditLogStatus.error:
        return AppErrorState(
          message: state.errorMessage ?? kAuditLogLoadError,
          retryLabel: 'Thử lại',
          onRetry: _cubit.load,
        );
      case AuditLogStatus.ready:
        if (state.items.isEmpty) {
          final bool filtering =
              state.targetType != null ||
              state.from != null ||
              state.to != null;
          return filtering
              ? const AppEmptyState(
                  title: 'Không có bản ghi phù hợp',
                  message: 'Thử đổi bộ lọc.',
                )
              : const AppEmptyState(title: 'Chưa có bản ghi nào');
        }
        final int totalPages = state.total <= 0 || state.pageSize <= 0
            ? 1
            : (state.total + state.pageSize - 1) ~/ state.pageSize;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            for (final AuditLogEntry entry in state.items) ...<Widget>[
              _card(entry),
              const SizedBox(height: AppTokens.space8),
            ],
            if (totalPages > 1) _pager(state.page, totalPages),
          ],
        );
    }
  }

  Widget _pager(int page, int totalPages) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: <Widget>[
        AppButton(
          label: 'Trước',
          variant: AppButtonVariant.ghost,
          size: AppButtonSize.sm,
          onPressed: page <= 1 ? null : () => _cubit.goToPage(page - 1),
        ),
        const SizedBox(width: AppTokens.space8),
        Text('Trang $page/$totalPages', style: _muted),
        const SizedBox(width: AppTokens.space8),
        AppButton(
          label: 'Sau',
          variant: AppButtonVariant.ghost,
          size: AppButtonSize.sm,
          onPressed: page >= totalPages
              ? null
              : () => _cubit.goToPage(page + 1),
        ),
      ],
    );
  }

  static const TextStyle _muted = TextStyle(
    color: AppTokens.muted,
    fontFamily: AppTokens.fontFamily,
    fontSize: 12.0,
    fontWeight: FontWeight.w600,
  );

  Widget _card(AuditLogEntry entry) {
    return AppCard(
      key: ValueKey<String>('audit-${entry.id}'),
      padding: const EdgeInsets.all(AppTokens.space12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: Text(
                  _actorText(entry),
                  style: const TextStyle(
                    color: AppTokens.ink,
                    fontFamily: AppTokens.fontFamily,
                    fontSize: 14.0,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Text(
                ngayGio(entry.occurredAt.toIso8601String()),
                style: _muted.copyWith(
                  fontFeatures: const <FontFeature>[
                    FontFeature.tabularFigures(),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppTokens.space4),
          Text(
            entry.eventLabel,
            style: const TextStyle(
              color: AppTokens.teal700,
              fontFamily: AppTokens.fontFamily,
              fontSize: 13.0,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppTokens.space4),
          Text(_targetText(entry), style: _muted),
          for (final AuditChange change in entry.changes)
            Text(
              '${change.field.isEmpty ? '' : '${change.field}: '}'
              '${_renderValue(change, change.before)} → ${_renderValue(change, change.after)}',
              style: _muted,
            ),
        ],
      ),
    );
  }
}
