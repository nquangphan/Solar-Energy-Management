// hand-authored — Flutter app-screen (Story 3.4). Mobile twin of the web
// CustomerPickScreen: tra SĐT ⇒ chọn khách cũ hoặc tạo khách mới NGAY TẠI MÀN,
// composed from shipped widgets (AppCard/AppFrame/AppField/AppButton/AppBanner/
// AppCustomerTypeChip) + tokens (AD-13).
//
// THE CLIENT NEVER TOUCHES A PHONE NUMBER (AD-9). The raw string the user typed
// goes straight to the port; the backend normalises it, decides validity, and
// returns the E.164 key. No regex here, no length check, no format message — the
// message on screen is the one the backend sent (AD-5).
//
// Lookup fires on an EXPLICIT action, not per keystroke: the client may not judge
// whether a half-typed number is "long enough" to send.
//
// `onSelect(customer)` is the entire API this screen leaves for Story 4.1 — it
// does NOT navigate to an order (no order exists until Epic 4).

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/customers_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';

/// Index of the locked bottom-nav `Menu` tab — the customer screens are reached from
/// it. The 5 tabs are LOCKED (UX-DR-15) and none of them is "Khách": marking `Đơn hàng`
/// active while standing on a customer screen would just be the nav lying about where
/// the user is.
const int kMenuTabIndex = 4;

const String kCaNhan = 'CA_NHAN';
const String kThuongMai = 'THUONG_MAI';

/// Label of a customer type — the chip text, shared by all three customer screens.
String customerTypeLabel(String custType) =>
    custType == kThuongMai ? 'Thương mại' : 'Cá nhân';

/// An empty nullable field shows `—`: the row stays, so the user knows it is blank.
String orDash(String? value) => (value == null || value.isEmpty) ? '—' : value;

class CustomerPickScreen extends StatefulWidget {
  const CustomerPickScreen({super.key, required this.port, this.onSelect});

  final CustomersPort port;
  final void Function(Customer customer)? onSelect;

  @override
  State<CustomerPickScreen> createState() => _CustomerPickScreenState();
}

class _CustomerPickScreenState extends State<CustomerPickScreen> {
  final TextEditingController _sdt = TextEditingController();
  final TextEditingController _name = TextEditingController();
  final TextEditingController _cccd = TextEditingController();
  final TextEditingController _taxCode = TextEditingController();
  final TextEditingController _address = TextEditingController();
  final TextEditingController _bankAccount = TextEditingController();
  final TextEditingController _sourceNote = TextEditingController();

  CustomerLookup? _result;
  String? _error;
  Map<String, String> _fieldErrors = const <String, String>{};
  bool _creating = false;

  String _custType = kCaNhan;
  String _sourceId = '';
  List<CustomerSource> _sources = const [];

  @override
  void initState() {
    super.initState();
    widget.port.listSources().then((List<CustomerSource> sources) {
      if (mounted) setState(() => _sources = sources);
    }).catchError((Object _) {
      if (mounted) setState(() => _sources = const <CustomerSource>[]);
    });
  }

  @override
  void dispose() {
    _sdt.dispose();
    _name.dispose();
    _cccd.dispose();
    _taxCode.dispose();
    _address.dispose();
    _bankAccount.dispose();
    _sourceNote.dispose();
    super.dispose();
  }

  // `isOther` is read from the FLAG the backend sends — never by comparing the
  // source name to a literal. Story 3.5 lets an admin rename a source, and a rule
  // must not collapse because someone edited a label.
  bool get _needsSourceNote {
    for (final CustomerSource source in _sources) {
      if (source.id == _sourceId) return source.isOther;
    }
    return false;
  }

  /// The message the BACKEND sent (AD-5) — never one invented here. An invalid phone
  /// is judged on the server (AD-9), so the sentence explaining it comes from there
  /// too; the generic line is only for a transport failure, which carries no envelope.
  void _showError(Object err) {
    setState(() {
      _error = err is CustomerPortException
          ? err.message
          : 'Không thực hiện được. Thử lại.';
      _fieldErrors = err is CustomerPortException
          ? err.fieldErrors
          : const <String, String>{};
    });
  }

  Future<void> _lookup() async {
    setState(() {
      _error = null;
      _fieldErrors = const <String, String>{};
      _creating = false;
    });
    try {
      // The RAW string, exactly as typed. The backend owns every judgement about it.
      final CustomerLookup found = await widget.port.lookup(_sdt.text);
      if (!mounted) return;
      setState(() => _result = found);
    } catch (err) {
      if (!mounted) return;
      setState(() => _result = null);
      _showError(err);
    }
  }

  Future<void> _create() async {
    setState(() {
      _error = null;
      _fieldErrors = const <String, String>{};
    });
    try {
      final Customer created = await widget.port.create(
        CreateCustomerInput(
          // Still the raw string — the backend re-normalises it into the key it stores.
          sdt: _sdt.text,
          custType: _custType,
          name: _name.text,
          cccd:
              _custType == kCaNhan && _cccd.text.isNotEmpty ? _cccd.text : null,
          taxCode: _custType == kThuongMai && _taxCode.text.isNotEmpty
              ? _taxCode.text
              : null,
          address: _address.text.isNotEmpty ? _address.text : null,
          bankAccount: _custType == kThuongMai && _bankAccount.text.isNotEmpty
              ? _bankAccount.text
              : null,
          sourceId: _sourceId,
          sourceNote: _sourceNote.text.isNotEmpty ? _sourceNote.text : null,
        ),
      );
      if (!mounted) return;
      widget.onSelect?.call(created);
    } catch (err) {
      if (!mounted) return;
      _showError(err);
    }
  }

  /// A backend field error, pinned under the input it names (AD-5). Nothing renders
  /// when the backend did not complain about that field.
  Widget _fieldError(String field) {
    final String? message = _fieldErrors[field];
    if (message == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: AppTokens.space8),
      child: AppBanner(tone: AppBannerTone.danger, message: message),
    );
  }

  @override
  Widget build(BuildContext context) {
    final CustomerLookup? result = _result;

    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: const AppTopbar(
          eyebrow: 'KHÁCH HÀNG',
          title: 'Tra cứu theo số điện thoại',
        ),
        bottomNav: const AppBottomNav(activeIndex: kMenuTabIndex),
        body: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AppFrame(
                label: 'Tra cứu theo số điện thoại',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    AppField(
                      label: 'SĐT',
                      size: AppFieldSize.large,
                      controller: _sdt,
                    ),
                    const SizedBox(height: AppTokens.space12),
                    AppButton(
                      variant: AppButtonVariant.primary,
                      label: 'Tra cứu',
                      wide: true,
                      onPressed: _lookup,
                    ),
                  ],
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: AppTokens.space12),
                AppBanner(
                  tone: AppBannerTone.danger,
                  icon: 'ic-alert',
                  message: _error!,
                ),
              ],
              if (result != null && result.found && !_creating) ...[
                const SizedBox(height: AppTokens.space16),
                _hit(result.customer!),
              ],
              if (result != null && !result.found && !_creating) ...[
                const SizedBox(height: AppTokens.space16),
                _miss(),
              ],
              if (_creating) ...[
                const SizedBox(height: AppTokens.space16),
                _createForm(),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _hit(Customer customer) {
    return AppCard(
      variant: AppCardVariant.teal,
      padding: const EdgeInsets.all(AppTokens.space16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // The title takes the room the chip leaves and WRAPS. Left to its natural
          // width it runs past the 330px phone frame — and text that overflows is text
          // the user cannot read.
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Expanded(
                child: Text(
                  'Khách cũ — trùng khớp',
                  style: TextStyle(
                    color: AppTokens.ink,
                    fontFamily: AppTokens.fontFamily,
                    fontSize: 15.0,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(width: AppTokens.space8),
              AppCustomerTypeChip(label: customerTypeLabel(customer.custType)),
            ],
          ),
          const SizedBox(height: AppTokens.space16),
          CustomerFacts(customer: customer, sources: _sources),
          const SizedBox(height: AppTokens.space16),
          AppButton(
            variant: AppButtonVariant.primary,
            label: 'Dùng khách này',
            wide: true,
            onPressed: () => widget.onSelect?.call(customer),
          ),
          const SizedBox(height: AppTokens.space8),
          AppButton(
            variant: AppButtonVariant.ghost,
            label: 'Không phải khách này? Tạo khách hàng mới →',
            wide: true,
            onPressed: () => setState(() => _creating = true),
          ),
        ],
      ),
    );
  }

  Widget _miss() {
    // The exact empty-state copy (UX-DR-19). EXPERIENCE.md forbids the generic
    // no-results phrasing by name — a dead end is not an answer; the way forward is
    // the button beneath it.
    return AppCard(
      padding: const EdgeInsets.all(AppTokens.space16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'SĐT chưa có trong hệ thống.',
            style: TextStyle(
              color: AppTokens.ink,
              fontFamily: AppTokens.fontFamily,
              fontSize: 14.0,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppTokens.space16),
          AppButton(
            variant: AppButtonVariant.primary,
            label: 'Tạo khách hàng mới',
            wide: true,
            onPressed: () => setState(() => _creating = true),
          ),
        ],
      ),
    );
  }

  Widget _createForm() {
    final bool commercial = _custType == kThuongMai;
    return AppFrame(
      label: 'Tạo khách hàng mới',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _MicroLabel('Loại khách'),
          const SizedBox(height: AppTokens.space8),
          // No segmented widget ships in the mobile design-system, so the control is
          // COMPOSED from AppButton rather than adding a component for one screen.
          Row(
            children: [
              Expanded(
                child: AppButton(
                  variant: commercial
                      ? AppButtonVariant.outline
                      : AppButtonVariant.primary,
                  label: 'Cá nhân',
                  onPressed: () => setState(() => _custType = kCaNhan),
                ),
              ),
              const SizedBox(width: AppTokens.space8),
              Expanded(
                child: AppButton(
                  variant: commercial
                      ? AppButtonVariant.primary
                      : AppButtonVariant.outline,
                  label: 'Thương mại',
                  onPressed: () => setState(() => _custType = kThuongMai),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppTokens.space12),
          AppField(
            label: commercial ? 'Tên đơn vị' : 'Họ tên',
            size: AppFieldSize.large,
            controller: _name,
          ),
          _fieldError('name'),
          const SizedBox(height: AppTokens.space12),
          // Each type carries its OWN fields. Sending a `taxCode` with a Cá nhân is a
          // 400 from the backend — so the field simply is not offered.
          if (commercial) ...[
            AppField(
              label: 'MST',
              size: AppFieldSize.large,
              controller: _taxCode,
            ),
            _fieldError('taxCode'),
          ] else ...[
            AppField(
              label: 'CCCD',
              size: AppFieldSize.large,
              controller: _cccd,
            ),
            _fieldError('cccd'),
          ],
          const SizedBox(height: AppTokens.space12),
          AppField(
            label: 'Địa chỉ',
            size: AppFieldSize.large,
            controller: _address,
          ),
          if (commercial) ...[
            const SizedBox(height: AppTokens.space12),
            AppField(
              label: 'Tài khoản NH',
              size: AppFieldSize.large,
              controller: _bankAccount,
            ),
            _fieldError('bankAccount'),
          ],
          const SizedBox(height: AppTokens.space12),
          const _MicroLabel('Nguồn khách'),
          const SizedBox(height: AppTokens.space8),
          // No default selection: the source is a real business fact, and a pre-picked
          // one would be the app answering a question the user never did. Rendered
          // verbatim (NOT through _MicroLabel, which uppercases) — the web renders the
          // same placeholder as-is, and the labels must stay byte-identical.
          if (_sourceId.isEmpty)
            const Text(
              '— Chọn nguồn —',
              style: TextStyle(
                color: AppTokens.muted,
                fontFamily: AppTokens.fontFamily,
                fontSize: 13.0,
                fontWeight: FontWeight.w600,
              ),
            ),
          for (final CustomerSource source in _sources) ...[
            const SizedBox(height: AppTokens.space8),
            AppButton(
              variant: source.id == _sourceId
                  ? AppButtonVariant.primary
                  : AppButtonVariant.outline,
              label: source.name,
              wide: true,
              onPressed: () => setState(() => _sourceId = source.id),
            ),
          ],
          _fieldError('sourceId'),
          if (_needsSourceNote) ...[
            const SizedBox(height: AppTokens.space12),
            AppField(
              label: 'Ghi rõ nguồn',
              size: AppFieldSize.large,
              controller: _sourceNote,
            ),
            _fieldError('sourceNote'),
          ],
          const SizedBox(height: AppTokens.space16),
          AppButton(
            variant: AppButtonVariant.primary,
            label: 'Lưu khách hàng',
            wide: true,
            onPressed: _create,
          ),
          const SizedBox(height: AppTokens.space8),
          AppButton(
            variant: AppButtonVariant.ghost,
            label: 'Huỷ',
            wide: true,
            onPressed: () => setState(() => _creating = false),
          ),
        ],
      ),
    );
  }
}

/// The `dl.kv` fact list — ONLY the fields that belong to this customer's type.
/// A Cá nhân has no MST and no bank account; rendering those rows empty would tell
/// the user a field exists for them when the backend would reject it outright.
class CustomerFacts extends StatelessWidget {
  const CustomerFacts({
    super.key,
    required this.customer,
    required this.sources,
  });

  final Customer customer;
  final List<CustomerSource> sources;

  CustomerSource? get _source {
    for (final CustomerSource source in sources) {
      if (source.id == customer.sourceId) return source;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final bool commercial = customer.custType == kThuongMai;
    final CustomerSource? source = _source;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _kv(commercial ? 'Tên đơn vị' : 'Họ tên', customer.name),
        if (commercial)
          _kv('MST', orDash(customer.taxCode))
        else
          _kv('CCCD', orDash(customer.cccd)),
        _kv('Địa chỉ', orDash(customer.address)),
        _kv('SĐT (khoá chính)', customer.sdt),
        if (commercial) _kv('Tài khoản NH', orDash(customer.bankAccount)),
        _kv('Nguồn khách', orDash(source?.name)),
        if (source != null && source.isOther)
          _kv('Ghi rõ nguồn', orDash(customer.sourceNote)),
      ],
    );
  }

  /// The mockup's `kv` row, composed from text + tokens rather than a new widget.
  Widget _kv(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTokens.space8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 140.0, child: _MicroLabel(label)),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: AppTokens.ink,
                fontFamily: AppTokens.fontFamily,
                fontSize: 13.0,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Micro-uppercase caption — the `kv` key / field caption, composed from tokens.
class _MicroLabel extends StatelessWidget {
  const _MicroLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(
        color: AppTokens.muted,
        fontFamily: AppTokens.fontFamily,
        fontSize: 10.0,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.08 * 10.0,
      ),
    );
  }
}
