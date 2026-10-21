// hand-authored — Flutter app-screen (Story 7.1, mobile twin of web
// web/src/screens/payments/PaymentScheduleScreen.tsx). Lịch thanh toán: view and
// edit the multi-installment payment schedule of one order.
//
// THE CLIENT COMPUTES NO MONEY. Installment amounts, both totals, the difference
// and the "totals match" verdict come from the backend. Templates only pre-fill
// the numbers the user would type (20/70/10 percent); the screen never multiplies
// a percent by a total or sums installments.
//
// A BLANK NUMBER IS NOT 0. A blank percent/amount field is sent as an ABSENT key
// (the backend answers 400); only a typed "0" is sent as 0.
//
// The edit button is shown only when the backend said `editable` AND the caller
// holds `payments.record` — UX gating only; the backend enforces both. Recording
// payments and debt progress are NOT here (they belong to story 7.2).
//
// LABELS are byte-identical with the web twin.

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/gating/app_permission_keys.g.dart';
import '../../design_system/gating/app_permissions.dart';
import '../../design_system/session/payments_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import '../orders/discount_approval_screen.dart' show kOrdersTabIndex;

const int _kMaxRows = 12;
const String _kKindPercent = 'percent';
const String _kKindAmount = 'amount';
const String _kTemplateCustom = 'custom';
const String _kTemplate207010 = '20/70/10';
const String _kTemplateFull = '100%';

const TextStyle _micro = TextStyle(
  color: AppTokens.muted,
  fontFamily: AppTokens.fontFamily,
  fontSize: 11.5,
  fontWeight: FontWeight.w600,
);
const TextStyle _strong = TextStyle(
  color: AppTokens.ink,
  fontFamily: AppTokens.fontFamily,
  fontSize: 12.5,
  fontWeight: FontWeight.w800,
);
const TextStyle _errorStyle = TextStyle(
  color: AppTokens.danger,
  fontFamily: AppTokens.fontFamily,
  fontSize: 11.5,
  fontWeight: FontWeight.w600,
);

final RegExp _nonDigit = RegExp(r'\D');
final RegExp _rowFieldPath =
    RegExp(r'^installments\.(\d+)\.(percent|amount|conditionNote)$');

/// Text for an input prefill (digits only, no formatting).
String _digits(int value) => value.toString();

enum _LoadState { loading, ready, error }

class _RowErrors {
  String? number;
  String? note;
}

class _Row {
  _Row({this.kind = _kKindPercent, String number = '', String note = ''})
      : number = TextEditingController(text: number),
        note = TextEditingController(text: note);

  String kind;
  final TextEditingController number;
  final TextEditingController note;

  void dispose() {
    number.dispose();
    note.dispose();
  }
}

class PaymentScheduleScreen extends StatefulWidget {
  const PaymentScheduleScreen({
    super.key,
    required this.port,
    required this.orderId,
    this.onBack,
    this.perms = const <PermissionKey>{},
  });

  final PaymentsPort port;
  final String orderId;
  final VoidCallback? onBack;

  /// The caller's effective permissions — gates the edit button (UX only).
  final Set<PermissionKey> perms;

  @override
  State<PaymentScheduleScreen> createState() => _PaymentScheduleScreenState();
}

class _PaymentScheduleScreenState extends State<PaymentScheduleScreen> {
  _LoadState _state = _LoadState.loading;
  PaymentSchedule? _schedule;
  int _ticket = 0;

  bool _editing = false;
  bool _saving = false;
  String _template = _kTemplateCustom;
  final List<_Row> _rows = <_Row>[];
  final Map<int, _RowErrors> _rowErrors = <int, _RowErrors>{};
  String? _formError;
  String? _conflict;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _clearRows();
    super.dispose();
  }

  void _clearRows() {
    for (final _Row r in _rows) {
      r.dispose();
    }
    _rows.clear();
  }

  Future<void> _load() async {
    final int ticket = ++_ticket;
    setState(() {
      _state = _LoadState.loading;
      _editing = false;
      _conflict = null;
      _formError = null;
      _rowErrors.clear();
    });
    try {
      final PaymentSchedule s = await widget.port.getSchedule(widget.orderId);
      if (!mounted || ticket != _ticket) return;
      setState(() {
        _schedule = s;
        _state = _LoadState.ready;
      });
    } catch (_) {
      if (!mounted || ticket != _ticket) return;
      setState(() => _state = _LoadState.error);
    }
  }

  bool get _canEdit =>
      (_schedule?.editable ?? false) &&
      can(widget.perms, AppPermissionKeys.paymentsRecord);

  void _startEdit() {
    final PaymentSchedule s = _schedule!;
    _clearRows();
    if (s.configured && s.installments.isNotEmpty) {
      for (final Installment i in s.installments) {
        _rows.add(
          i.percent != null
              ? _Row(
                  kind: _kKindPercent,
                  number: _digits(i.percent!),
                  note: i.conditionNote,
                )
              : _Row(
                  kind: _kKindAmount,
                  number: _digits(i.amount),
                  note: i.conditionNote,
                ),
        );
      }
    } else {
      _rows.add(_Row());
    }
    setState(() {
      _editing = true;
      _template = _kTemplateCustom;
      _formError = null;
      _conflict = null;
      _rowErrors.clear();
    });
  }

  void _cancelEdit() {
    setState(() {
      _editing = false;
      _formError = null;
      _conflict = null;
      _rowErrors.clear();
    });
  }

  void _applyTemplate(String template) {
    if (template == _kTemplateCustom) {
      setState(() => _template = template);
      return;
    }
    final List<(String, String)> spec = template == _kTemplate207010
        ? const <(String, String)>[
            ('20', 'Cọc khi ký hợp đồng'),
            ('70', 'Khi thi công'),
            ('10', 'Khi nghiệm thu, bàn giao'),
          ]
        : const <(String, String)>[('100', 'Thanh toán toàn bộ')];
    _clearRows();
    for (final (String, String) s in spec) {
      _rows.add(_Row(number: s.$1, note: s.$2));
    }
    setState(() {
      _template = template;
      _rowErrors.clear();
      _formError = null;
    });
  }

  void _addRow() {
    if (_rows.length >= _kMaxRows) return;
    setState(() {
      _rows.add(_Row());
      _template = _kTemplateCustom;
    });
  }

  void _removeRow(int index) {
    if (_rows.length <= 1) return;
    setState(() {
      _rows.removeAt(index).dispose();
      _rowErrors.clear();
      _template = _kTemplateCustom;
    });
  }

  void _setKind(_Row row, String kind) {
    if (row.kind == kind) return;
    setState(() {
      row.kind = kind;
      row.number.clear();
      _template = _kTemplateCustom;
    });
  }

  /// Digits only. A field with no digit stays blank (null) — never 0.
  void _digitsOnly(_Row row, String value) {
    final String digits = value.replaceAll(_nonDigit, '');
    if (digits != value) {
      row.number.value = TextEditingValue(
        text: digits,
        selection: TextSelection.collapsed(offset: digits.length),
      );
    }
  }

  ReplacePaymentScheduleInput _buildInput() {
    return ReplacePaymentScheduleInput(
      installments: <InstallmentInput>[
        for (final _Row r in _rows)
          InstallmentInput(
            percent:
                r.kind == _kKindPercent ? int.tryParse(r.number.text) : null,
            amount: r.kind == _kKindAmount ? int.tryParse(r.number.text) : null,
            conditionNote: r.note.text.trim(),
          ),
      ],
    );
  }

  Future<void> _save() async {
    if (_saving) return;
    final ReplacePaymentScheduleInput input = _buildInput();
    setState(() {
      _saving = true;
      _formError = null;
      _conflict = null;
      _rowErrors.clear();
    });
    try {
      final PaymentSchedule s =
          await widget.port.replaceSchedule(widget.orderId, input);
      if (!mounted) return;
      setState(() {
        _saving = false;
        _schedule = s;
        _editing = false;
      });
    } on PaymentsPortError catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _mapError(e);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _formError = 'Không lưu được lịch thanh toán. Vui lòng thử lại.';
      });
    }
  }

  void _mapError(PaymentsPortError e) {
    if (e.code == 'CONFLICT') {
      _conflict = e.message;
      return;
    }
    final List<FieldError> fields = e.fieldErrors ?? const <FieldError>[];
    final List<String> general = <String>[];
    for (final FieldError f in fields) {
      final RegExpMatch? m = _rowFieldPath.firstMatch(f.field);
      final int? index = m == null ? null : int.parse(m.group(1)!);
      if (m == null || index! >= _rows.length) {
        general.add(f.message);
        continue;
      }
      final _RowErrors errors = _rowErrors.putIfAbsent(index, _RowErrors.new);
      if (m.group(2) == 'conditionNote') {
        errors.note ??= f.message;
      } else {
        errors.number ??= f.message;
      }
    }
    if (general.isNotEmpty) {
      _formError = general.join('\n');
    } else if (_rowErrors.isEmpty) {
      _formError = e.message;
    }
  }

  // ---- view ----------------------------------------------------------------

  Widget _body() {
    switch (_state) {
      case _LoadState.loading:
        return const Column(
          children: <Widget>[AppSkeleton(), AppSkeleton(), AppSkeleton()],
        );
      case _LoadState.error:
        return AppErrorState(
          message: 'Không tải được lịch thanh toán.',
          retryLabel: 'Thử lại',
          onRetry: _load,
        );
      case _LoadState.ready:
        return _editing ? _editMode() : _viewMode();
    }
  }

  Widget _editButton(PaymentSchedule s) => AppButton(
        label: s.configured ? 'Sửa lịch' : 'Cấu hình lịch',
        variant: AppButtonVariant.primary,
        onPressed: _startEdit,
      );

  Widget _viewMode() {
    final PaymentSchedule s = _schedule!;
    if (!s.configured) {
      return AppEmptyState(
        title: 'Đơn chưa có lịch thanh toán.',
        action: _canEdit ? _editButton(s) : null,
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        AppFrame(
          label: 'Các đợt thanh toán',
          onBg: true,
          padding: EdgeInsets.zero,
          child: AppTable(
            columns: const <AppTableColumn>[
              AppTableColumn('Đợt', flex: 4),
              AppTableColumn('Điều kiện', flex: 4),
              AppTableColumn('Tỉ lệ', numeric: true, flex: 2),
              AppTableColumn('Số tiền', numeric: true, flex: 4),
            ],
            rows: <AppTableRow>[
              for (final Installment i in s.installments)
                AppTableRow(<Widget>[
                  AppTableCellText(_installmentName(i), strong: true),
                  AppTableCellText(i.conditionNote),
                  AppTableCellText(i.percent == null ? '—' : '${i.percent}%'),
                  MoneyText(i.amount),
                ]),
            ],
          ),
        ),
        const SizedBox(height: AppTokens.space12),
        _totalRow('Tổng lịch', s.scheduledTotal),
        const SizedBox(height: AppTokens.space4),
        _totalRow('Tổng đơn (sau VAT)', s.orderTotal),
        if (!s.totalMatches) ...<Widget>[
          const SizedBox(height: AppTokens.space12),
          AppBanner(
            tone: AppBannerTone.warn,
            child: Wrap(
              spacing: AppTokens.space4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: <Widget>[
                const Text('Tổng các đợt lệch tổng đơn sau VAT'),
                MoneyText(s.difference),
              ],
            ),
          ),
        ],
        if (_canEdit) ...<Widget>[
          const SizedBox(height: AppTokens.space12),
          Align(alignment: Alignment.centerLeft, child: _editButton(s)),
        ],
      ],
    );
  }

  String _installmentName(Installment i) {
    final String suffix = i.milestone == 'coc'
        ? ' · Cọc'
        : i.milestone == 'tat_toan'
            ? ' · Tất toán'
            : '';
    return 'Đợt ${i.seq}$suffix';
  }

  Widget _totalRow(String label, int value) => Row(
        children: <Widget>[
          Expanded(child: Text(label, style: _micro)),
          const SizedBox(width: AppTokens.space8),
          MoneyText(value, style: _strong),
        ],
      );

  Widget _editMode() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Wrap(
          spacing: AppTokens.space8,
          runSpacing: AppTokens.space8,
          children: <Widget>[
            for (final (String, String) t in const <(String, String)>[
              (_kTemplate207010, '20/70/10'),
              (_kTemplateFull, '100%'),
              (_kTemplateCustom, 'Tuỳ chỉnh'),
            ])
              AppButton(
                label: t.$2,
                size: AppButtonSize.sm,
                variant: _template == t.$1
                    ? AppButtonVariant.primary
                    : AppButtonVariant.outline,
                onPressed: () => _applyTemplate(t.$1),
              ),
          ],
        ),
        for (int i = 0; i < _rows.length; i++) ...<Widget>[
          const SizedBox(height: AppTokens.space12),
          _rowEditor(i, _rows[i]),
        ],
        const SizedBox(height: AppTokens.space12),
        Align(
          alignment: Alignment.centerLeft,
          child: AppButton(
            label: 'Thêm đợt',
            size: AppButtonSize.sm,
            onPressed: _rows.length >= _kMaxRows ? null : _addRow,
          ),
        ),
        if (_formError != null) ...<Widget>[
          const SizedBox(height: AppTokens.space8),
          AppBanner(tone: AppBannerTone.danger, message: _formError),
        ],
        if (_conflict != null) ...<Widget>[
          const SizedBox(height: AppTokens.space8),
          AppBanner(tone: AppBannerTone.danger, message: _conflict),
          const SizedBox(height: AppTokens.space8),
          Align(
            alignment: Alignment.centerLeft,
            child: AppButton(
              label: 'Tải lại',
              size: AppButtonSize.sm,
              onPressed: _load,
            ),
          ),
        ],
        const SizedBox(height: AppTokens.space12),
        Wrap(
          spacing: AppTokens.space8,
          runSpacing: AppTokens.space8,
          children: <Widget>[
            AppButton(
              label: _saving ? 'Đang lưu…' : 'Lưu lịch',
              variant: AppButtonVariant.primary,
              onPressed: _saving ? null : _save,
            ),
            AppButton(
              label: 'Huỷ',
              onPressed: _saving ? null : _cancelEdit,
            ),
          ],
        ),
      ],
    );
  }

  Widget _rowEditor(int index, _Row row) {
    final _RowErrors? errors = _rowErrors[index];
    final bool isPercent = row.kind == _kKindPercent;
    return AppCard(
      key: ObjectKey(row),
      padding: const EdgeInsets.all(AppTokens.space12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text('Đợt ${index + 1}', style: _strong),
          const SizedBox(height: AppTokens.space8),
          Wrap(
            spacing: AppTokens.space8,
            runSpacing: AppTokens.space8,
            children: <Widget>[
              AppButton(
                label: '%',
                size: AppButtonSize.sm,
                variant: isPercent
                    ? AppButtonVariant.primary
                    : AppButtonVariant.outline,
                onPressed: () => _setKind(row, _kKindPercent),
              ),
              AppButton(
                label: 'Số tiền',
                size: AppButtonSize.sm,
                variant: isPercent
                    ? AppButtonVariant.outline
                    : AppButtonVariant.primary,
                onPressed: () => _setKind(row, _kKindAmount),
              ),
            ],
          ),
          const SizedBox(height: AppTokens.space8),
          AppField(
            key: ValueKey<String>('number-${row.kind}'),
            label: isPercent ? 'Tỉ lệ (%)' : 'Số tiền (đồng)',
            controller: row.number,
            keyboardType: TextInputType.number,
            onChanged: (String v) => _digitsOnly(row, v),
          ),
          if (errors?.number != null)
            Padding(
              padding: const EdgeInsets.only(top: AppTokens.space4),
              child: Text(errors!.number!, style: _errorStyle),
            ),
          const SizedBox(height: AppTokens.space8),
          AppField(label: 'Điều kiện', controller: row.note),
          if (errors?.note != null)
            Padding(
              padding: const EdgeInsets.only(top: AppTokens.space4),
              child: Text(errors!.note!, style: _errorStyle),
            ),
          const SizedBox(height: AppTokens.space8),
          Align(
            alignment: Alignment.centerLeft,
            child: AppButton(
              label: 'Xoá đợt',
              size: AppButtonSize.sm,
              variant: AppButtonVariant.danger,
              onPressed: _rows.length <= 1 ? null : () => _removeRow(index),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: AppTopbar(
          eyebrow: 'CÔNG NỢ',
          title: 'Lịch thanh toán',
          onBack: widget.onBack,
        ),
        bottomNav: const AppBottomNav(activeIndex: kOrdersTabIndex),
        body: SingleChildScrollView(child: _body()),
      ),
    );
  }
}
