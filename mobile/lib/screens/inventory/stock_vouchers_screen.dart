// hand-authored — Flutter app-screen (Story 6.3, mobile twin of web
// web/src/screens/inventory/StockVouchersScreen.tsx). Phiếu kho: recent stock-in
// / stock-out vouchers, one voucher's detail, and the sheet that creates one.
//
// THE CLIENT COMPUTES NOTHING (AD-2). The voucher code, line count, total
// quantity, the weighted-average cost and the "not enough stock" refusal are the
// backend's. The screen never multiplies a quantity by a cost, never compares a
// quantity with what is on hand — it shows "Còn N" from the stock list and lets
// the backend say no. The `+N` / `−N` sign is glued on as TEXT from the type.
//
// `unitCost` is null when the caller lacks `costs.view`: no column, no "0".
//
// LABELS are byte-identical with the web twin (UX-DR-27).

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/inventory_port.dart';
import '../../design_system/session/stock_vouchers_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import 'inventory_screen.dart' show kInventoryTabIndex;

const String _kNoteNhap =
    'Giá vốn ở đây không được bỏ trống. Hệ thống lấy nó tính bình quân gia quyền rồi cập nhật giá vốn hiện hành của sản phẩm — một chỗ gõ, không ai phải nhớ sửa hai nơi.';
const String _kNoteXuat =
    'Phiếu xuất không gắn đơn (hàng hỏng, mẫu, điều chỉnh). Không sửa/xoá sau khi lưu.';
const String _kTonDauKy = 'Tồn đầu kỳ';

/// TWIN of `ngayNgan()` in web format-gio.ts: ISO UTC ⇒ `dd/MM` at a fixed UTC+7.
String ngayNgan(String iso) {
  final DateTime? t = DateTime.tryParse(iso);
  if (t == null) return '—';
  final DateTime v = t.toUtc().add(const Duration(hours: 7));
  return '${_hai(v.day)}/${_hai(v.month)}';
}

/// TWIN of `ngayGio()` in web format-gio.ts: ISO UTC ⇒ `dd/MM/yyyy · HH:mm` at UTC+7.
String ngayGio(String iso) {
  final DateTime? t = DateTime.tryParse(iso);
  if (t == null) return '—';
  final DateTime v = t.toUtc().add(const Duration(hours: 7));
  return '${_hai(v.day)}/${_hai(v.month)}/${v.year} · ${_hai(v.hour)}:${_hai(v.minute)}';
}

String _hai(int n) => n.toString().padLeft(2, '0');

/// `+40` / `−14` — a sign glued on as text from the type. TWIN of `soLuongCoDau()`.
String _soLuongCoDau(String type, int qty) =>
    '${type == 'nhap' ? '+' : '−'}$qty';

String _moTaLoai(String type) =>
    type == 'nhap' ? 'Nhập kho' : 'Xuất kho · không gắn đơn';

/// Keep digits only — quantities and costs are whole numbers; the backend validates ranges.
/// No digit ⇒ null (blank is NOT 0: a blank cost must reach the backend as absent).
int? _chiChuSo(String text) => int.tryParse(text.replaceAll(RegExp(r'\D'), ''));

enum _LoadState { loading, ready, error }

class _DongForm {
  _DongForm(this.sp);

  final StockItemView sp;
  final TextEditingController qty = TextEditingController();
  final TextEditingController unitCost = TextEditingController();

  void dispose() {
    qty.dispose();
    unitCost.dispose();
  }
}

class StockVouchersScreen extends StatefulWidget {
  const StockVouchersScreen({
    super.key,
    required this.port,
    required this.inventoryPort,
    this.onBack,
  });

  final StockVouchersPort port;

  /// Product picker source — the same stock list the Tồn kho screen reads.
  final InventoryPort inventoryPort;
  final VoidCallback? onBack;

  @override
  State<StockVouchersScreen> createState() => _StockVouchersScreenState();
}

class _StockVouchersScreenState extends State<StockVouchersScreen> {
  _LoadState _state = _LoadState.loading;
  List<StockVoucherSummary> _items = <StockVoucherSummary>[];

  String? _selectedId;
  _LoadState _detailState = _LoadState.loading;
  StockVoucherDetail? _detail;

  @override
  void initState() {
    super.initState();
    _tai();
  }

  Future<void> _tai() async {
    setState(() => _state = _LoadState.loading);
    try {
      final StockVoucherList kq = await widget.port.listVouchers();
      if (!mounted) return;
      setState(() {
        _items = kq.items;
        _state = _LoadState.ready;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _state = _LoadState.error);
    }
  }

  Future<void> _chon(String id) async {
    setState(() {
      _selectedId = id;
      _detailState = _LoadState.loading;
    });
    try {
      final StockVoucherDetail d = await widget.port.getVoucher(id);
      if (!mounted || _selectedId != id) return;
      setState(() {
        _detail = d;
        _detailState = _LoadState.ready;
      });
    } catch (_) {
      if (!mounted || _selectedId != id) return;
      setState(() => _detailState = _LoadState.error);
    }
  }

  /// TWIN of `nhanLoai()` in the web screen.
  Widget _chipLoai(String type) {
    final bool nhap = type == 'nhap';
    final Color mau = nhap ? AppTokens.ok : AppTokens.warn;
    return AppChip(
      label: nhap ? 'Nhập' : 'Xuất',
      background: AppTokens.surface,
      foreground: mau,
      border: mau,
    );
  }

  static const TextStyle _strong = TextStyle(
    color: AppTokens.ink,
    fontFamily: AppTokens.fontFamily,
    fontSize: 12.5,
    fontWeight: FontWeight.w800,
  );

  static const TextStyle _microMuted = TextStyle(
    color: AppTokens.muted,
    fontFamily: AppTokens.fontFamily,
    fontSize: AppTokens.microFontSize,
    fontWeight: FontWeight.w700,
  );

  static const TextStyle _so = TextStyle(
    color: AppTokens.ink,
    fontFamily: AppTokens.fontFamily,
    fontSize: 12.5,
    fontWeight: FontWeight.w800,
    fontFeatures: <FontFeature>[FontFeature.tabularFigures()],
  );

  Widget _hangPhieu(StockVoucherSummary p) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _chon(p.id),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppTokens.space12,
          vertical: AppTokens.space8,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                Flexible(
                  child: Text(
                    p.ma,
                    style: _so,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: AppTokens.space8),
                _chipLoai(p.type),
                const Spacer(),
                Text(_soLuongCoDau(p.type, p.tongSoLuong), style: _so),
              ],
            ),
            const SizedBox(height: AppTokens.space4),
            Text(
              '${p.nguoiTao.displayName} · ${ngayNgan(p.createdAt)}',
              style: _microMuted,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTokens.space4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(width: 76.0, child: Text(k, style: _microMuted)),
          Expanded(child: Text(v, style: _strong)),
        ],
      ),
    );
  }

  Widget _chiTiet() {
    final StockVoucherDetail? d = _detail;
    if (_detailState == _LoadState.loading) return const AppSkeleton();
    if (_detailState == _LoadState.error || d == null) {
      return AppErrorState(
        message: 'Không tải được chi tiết phiếu.',
        onRetry: () => _chon(_selectedId!),
      );
    }
    final bool coGiaVon =
        d.lines.any((StockVoucherLine l) => l.unitCost != null);
    return AppCard(
      variant: d.type == 'nhap' ? AppCardVariant.teal : AppCardVariant.line,
      padding: const EdgeInsets.all(AppTokens.space12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const Text('Chi tiết phiếu', style: _microMuted),
          const SizedBox(height: AppTokens.space4),
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  d.ma,
                  style: _so,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: AppTokens.space8),
              _chipLoai(d.type),
            ],
          ),
          const SizedBox(height: AppTokens.space8),
          _kv('Loại', _moTaLoai(d.type)),
          _kv('Ngày', ngayGio(d.createdAt)),
          _kv('Người tạo', d.nguoiTao.displayName),
          _kv('Ghi chú', d.note ?? '—'),
          const SizedBox(height: AppTokens.space8),
          AppTable(
            columns: <AppTableColumn>[
              const AppTableColumn('Sản phẩm', flex: 3),
              const AppTableColumn('SL', numeric: true, flex: 1),
              if (coGiaVon)
                const AppTableColumn('Giá vốn / đv', numeric: true, flex: 2),
            ],
            rows: <AppTableRow>[
              for (final StockVoucherLine l in d.lines)
                AppTableRow(<Widget>[
                  AppTableCellText(l.ten),
                  AppTableCellText(_soLuongCoDau(d.type, l.qty)),
                  if (coGiaVon)
                    AppTableCellText(
                      l.unitCost != null ? '${l.unitCost}' : '',
                      strong: true,
                    ),
                ]),
            ],
          ),
          const SizedBox(height: AppTokens.space8),
          AppBanner(
            tone: AppBannerTone.info,
            message: d.type == 'nhap' ? _kNoteNhap : _kNoteXuat,
          ),
        ],
      ),
    );
  }

  Widget _than() {
    switch (_state) {
      case _LoadState.loading:
        return const Column(
          children: <Widget>[AppSkeleton(), AppSkeleton(), AppSkeleton()],
        );
      case _LoadState.error:
        return AppErrorState(
          message: 'Không tải được phiếu kho.',
          onRetry: _tai,
        );
      case _LoadState.ready:
        if (_items.isEmpty) {
          return const AppEmptyState(
            icon: 'ic-warehouse',
            title: 'Chưa có phiếu kho nào. Bấm Tạo phiếu để bắt đầu.',
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            AppFrame(
              label: 'Gần đây',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  for (final StockVoucherSummary p in _items) _hangPhieu(p),
                ],
              ),
            ),
            if (_selectedId != null) ...<Widget>[
              const SizedBox(height: AppTokens.space12),
              _chiTiet(),
            ],
          ],
        );
    }
  }

  Future<void> _moForm() async {
    final String? moiId = await showAppSheet<String>(
      context: context,
      child: _FormPhieu(
        port: widget.port,
        inventoryPort: widget.inventoryPort,
      ),
    );
    if (moiId == null || !mounted) return;
    await _tai();
    if (!mounted) return;
    await _chon(moiId);
  }

  @override
  Widget build(BuildContext context) {
    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: AppTopbar(
          eyebrow: 'KHO',
          title: 'Phiếu kho',
          onBack: widget.onBack,
          action: const Text(
            'Tạo phiếu',
            style: TextStyle(
              color: AppTokens.teal,
              fontFamily: AppTokens.fontFamily,
              fontSize: 12.0,
              fontWeight: FontWeight.w800,
            ),
          ),
          onAction: _moForm,
        ),
        bottomNav: const AppBottomNav(activeIndex: kInventoryTabIndex),
        body: SingleChildScrollView(child: _than()),
      ),
    );
  }
}

/// The create-voucher sheet. Pops with the new voucher's id on success.
class _FormPhieu extends StatefulWidget {
  const _FormPhieu({required this.port, required this.inventoryPort});

  final StockVouchersPort port;
  final InventoryPort inventoryPort;

  @override
  State<_FormPhieu> createState() => _FormPhieuState();
}

class _FormPhieuState extends State<_FormPhieu> {
  String _loai = 'nhap';
  final TextEditingController _note = TextEditingController();
  final List<_DongForm> _dong = <_DongForm>[];
  List<StockItemView> _goiY = <StockItemView>[];
  int _goiYTicket = 0;
  bool _sending = false;
  StockVoucherPortException? _loi;

  @override
  void initState() {
    super.initState();
    _tim('');
  }

  @override
  void dispose() {
    _note.dispose();
    for (final _DongForm d in _dong) {
      d.dispose();
    }
    super.dispose();
  }

  Future<void> _tim(String q) async {
    final int ticket = ++_goiYTicket;
    try {
      final StockList kq = await widget.inventoryPort.listStock(q: q);
      if (!mounted || ticket != _goiYTicket) return;
      setState(() => _goiY = kq.items);
    } catch (_) {
      if (!mounted || ticket != _goiYTicket) return;
      setState(() => _goiY = <StockItemView>[]);
    }
  }

  void _themDong(StockItemView sp) {
    if (_dong.any((_DongForm d) => d.sp.productId == sp.productId)) return;
    setState(() => _dong.add(_DongForm(sp)));
  }

  Future<void> _luu() async {
    setState(() {
      _sending = true;
      _loi = null;
    });
    try {
      final String note = _note.text.trim();
      final StockVoucherDetail moi = await widget.port.createVoucher(
        CreateStockVoucherInput(
          type: _loai,
          note: note.isEmpty ? null : note,
          lines: <CreateStockVoucherLineInput>[
            for (final _DongForm d in _dong)
              CreateStockVoucherLineInput(
                productId: d.sp.productId,
                qty: _chiChuSo(d.qty.text) ?? 0,
                // Blank cost ⇒ null ⇒ omitted ⇒ the backend's "bắt buộc giá vốn" 400 —
                // never a fabricated 0, which is a valid cost it would average in.
                unitCost: _loai == 'nhap' ? _chiChuSo(d.unitCost.text) : null,
              ),
          ],
        ),
      );
      if (!mounted) return;
      Navigator.of(context).pop(moi.id);
    } on StockVoucherPortException catch (e) {
      if (!mounted) return;
      setState(() {
        _loi = e;
        _sending = false;
      });
    } catch (_) {
      // Not an AD-5 envelope (network down, transport bug): still re-enable Lưu phiếu.
      if (!mounted) return;
      setState(() {
        _loi =
            const StockVoucherPortException('Không lưu được phiếu. Thử lại.');
        _sending = false;
      });
    }
  }

  List<StockVoucherFieldError> _loiCuaDong(int i) => <StockVoucherFieldError>[
        for (final StockVoucherFieldError f
            in _loi?.fieldErrors ?? const <StockVoucherFieldError>[])
          if (f.field.startsWith('lines.$i.')) f,
      ];

  List<StockVoucherFieldError> _loiChung() => <StockVoucherFieldError>[
        for (final StockVoucherFieldError f
            in _loi?.fieldErrors ?? const <StockVoucherFieldError>[])
          if (!RegExp(r'^lines\.\d+\.').hasMatch(f.field)) f,
      ];

  static const TextStyle _strong = _StockVouchersScreenState._strong;
  static const TextStyle _microMuted = _StockVouchersScreenState._microMuted;

  Widget _dongForm(int i, _DongForm d) {
    return Padding(
      padding: const EdgeInsets.only(top: AppTokens.space8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(d.sp.ten, style: _strong),
                    Text('Còn ${d.sp.onHand} ${d.sp.donVi}',
                        style: _microMuted),
                  ],
                ),
              ),
              AppButton(
                icon: 'ic-trash',
                size: AppButtonSize.sm,
                variant: AppButtonVariant.ghost,
                onPressed: () => setState(() {
                  _dong.removeAt(i).dispose();
                  // Field errors are keyed by line index (`lines.N.*`): once a line goes,
                  // they would land under the wrong product.
                  _loi = null;
                }),
              ),
            ],
          ),
          const SizedBox(height: AppTokens.space4),
          Row(
            children: <Widget>[
              Expanded(
                child: AppField(
                  label: 'SL',
                  controller: d.qty,
                  keyboardType: TextInputType.number,
                ),
              ),
              if (_loai == 'nhap') ...<Widget>[
                const SizedBox(width: AppTokens.space8),
                Expanded(
                  child: AppField(
                    label: 'Giá vốn / đv *',
                    controller: d.unitCost,
                    keyboardType: TextInputType.number,
                  ),
                ),
              ],
            ],
          ),
          for (final StockVoucherFieldError f in _loiCuaDong(i))
            Text(
              f.message,
              style: const TextStyle(
                color: AppTokens.danger,
                fontFamily: AppTokens.fontFamily,
                fontSize: AppTokens.microFontSize,
                fontWeight: FontWeight.w700,
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final StockVoucherPortException? loi = _loi;
    return AppSheet(
      title: 'Tạo phiếu kho',
      onClose: () => Navigator.of(context).pop(),
      body: ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 460.0),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Row(
                children: <Widget>[
                  for (final String loai in <String>[
                    'nhap',
                    'xuat'
                  ]) ...<Widget>[
                    Expanded(
                      child: AppButton(
                        label: loai == 'nhap' ? 'Nhập' : 'Xuất',
                        size: AppButtonSize.sm,
                        variant: _loai == loai
                            ? AppButtonVariant.primary
                            : AppButtonVariant.outline,
                        onPressed: () => setState(() => _loai = loai),
                      ),
                    ),
                    if (loai == 'nhap') const SizedBox(width: AppTokens.space8),
                  ],
                ],
              ),
              const SizedBox(height: AppTokens.space8),
              AppBanner(
                tone: AppBannerTone.info,
                message: _loai == 'nhap' ? _kNoteNhap : _kNoteXuat,
              ),
              const SizedBox(height: AppTokens.space8),
              AppField(label: 'Ghi chú', controller: _note),
              const SizedBox(height: AppTokens.space4),
              Align(
                alignment: Alignment.centerLeft,
                child: AppButton(
                  label: _kTonDauKy,
                  size: AppButtonSize.sm,
                  onPressed: () => setState(() => _note.text = _kTonDauKy),
                ),
              ),
              const SizedBox(height: AppTokens.space8),
              AppField(
                label: 'Tìm sản phẩm để thêm dòng',
                onChanged: _tim,
              ),
              const SizedBox(height: AppTokens.space4),
              Wrap(
                spacing: AppTokens.space6,
                runSpacing: AppTokens.space6,
                children: <Widget>[
                  for (final StockItemView sp in _goiY)
                    AppButton(
                      label: '${sp.ten} · Còn ${sp.onHand} ${sp.donVi}',
                      size: AppButtonSize.sm,
                      variant: AppButtonVariant.ghost,
                      onPressed: () => _themDong(sp),
                    ),
                ],
              ),
              for (int i = 0; i < _dong.length; i++) _dongForm(i, _dong[i]),
              if (loi != null) ...<Widget>[
                const SizedBox(height: AppTokens.space8),
                AppBanner(
                  tone: AppBannerTone.danger,
                  message: <String>[
                    loi.message,
                    for (final StockVoucherFieldError f in _loiChung())
                      f.message,
                  ].join('\n'),
                ),
              ],
              const SizedBox(height: AppTokens.space8),
              AppButton(
                label: 'Lưu phiếu',
                variant: AppButtonVariant.primary,
                wide: true,
                onPressed: _sending || _dong.isEmpty ? null : _luu,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
