---
baseline_commit: 78c093e
---

# Story 11.3: Chuyển BLoC màn đơn hàng và báo giá

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a nhân viên bán hàng/hiện trường,
I want danh sách đơn, chi tiết đơn, chuyển trạng thái, duyệt chiết khấu và tạo báo giá chạy bằng Cubit mà luồng không đổi,
so that phần lõi của app theo khuôn BLoC trước khi Epic 8/9 nối thêm vào đơn.

[Refactor thuần mobile theo khuôn 11.1/11.2. **Không đổi hành vi người dùng thấy**: chữ, bố cục, điều hướng, thứ tự và số lượng request giữ nguyên. Backend/web không đổi. Đây là story nặng nhất Epic 11: 5 màn, 3.645 dòng, 143 ca widget + 17 ca `order_routes_test`.]

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

Đọc trước (theo thứ tự): `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-23.md` **§6 (20 mặc định, là luật) + §7 (11.1) + §8 (11.2)**; khuôn mẫu 11.2: `mobile/lib/screens/customers/{customer_pick,customer_list}_{screen,cubit,state}.dart` (cubit là field của `State` + `BlocProvider.value`), `mobile/test/screens/customers/{customer_list_cubit_test,recording_customers_port}.dart`, `mobile/test/screens/unmount_while_port_pending_menu_screens_test.dart`; 5 màn: `mobile/lib/screens/orders/{order_list,order_detail,order_status_change,discount_approval,create_quote}_screen.dart`; test widget: `mobile/test/screens/orders/*.dart` (10 file), `mobile/test/app/order_routes_test.dart`, `mobile/test/app/signed_in_app_test.dart`; guard: `mobile/test/screens/no_port_call_in_screens_test.dart`, `design-system/lib/read-mobile-screen.mjs`, 9 file `design-system/screens/{orders,orders-list,order-detail,order-transition,order-cancel,order-attachments,discount-approval,quote-stock-check,stock-issue}.test.mjs`, `design-system/money/money-render-guard.test.mjs` (tự walk `mobile/lib/screens`, không sửa).

### 1. Hiện trạng (scout 2026-10-23, HEAD `78c093e`)

| Màn | Port gọi (thứ tự) | State trong `State` hôm nay | Ghi chú phải giữ |
|---|---|---|---|
| `OrderListScreen({key, required OrdersPort port, required Set<PermissionKey> perms, onOpen, onAdd, onOpenDiscountApprovals, Listenable? reloadSignal})` (393) | `port.list(followUp, status, page)` ở `initState`, mỗi lần `reloadSignal` bắn, bấm lọc, Trước/Sau, Thử lại, sau khi `onOpen`/`onAdd`/`onOpenDiscountApprovals` xong (`_openThenReload`) | `_filter` (`_kAll`/`_kFollowUp`/`StatusKey.name`), `_items`, `_page`, `_total`, `_pageSize`(20), `_LoadState {loading, ready, error}`, `_latest` (vé) | `followUp: true` chỉ khi Follow-up; `status` null khi ALL/Follow-up; đổi lọc ⇒ `_page = 1` (`_reloadFromFirstPage`); vé bỏ trả lời cũ ở **cả** nhánh lỗi; `reloadSignal` add/remove listener ở `initState`/`didUpdateWidget`/`dispose`; rỗng + `_filter != _kAll` ⇒ "Không có đơn phù hợp", rỗng ALL ⇒ "Chưa có đơn nào" (+ nút khi `onAdd != null`); pager như danh sách khách |
| `OrderDetailScreen({key, required port, required orderId, onBack, onChangeStatus, onOpenPaymentSchedule, onOpenContracts, onOpenInvoices, pick, perms})` (1050, **3 State**: màn + `_StockIssueSheet` + `_HuyDonDialog`) | `initState`: `_load()` = `Future.wait([get, getLifecycle, listVersions])` (một vé `_latest`) **và** nếu `_canSeeStockIssue` thì `getStockIssue` (vé riêng). Tab Ảnh mở lần đầu ⇒ `listAttachments` rồi **tuần tự** `attachmentBytes` từng ảnh (vé `_anhLatest`, lỗi bytes một ảnh ⇒ bỏ qua). "Thêm ảnh" ⇒ `addAttachments` rồi `_loadAnh`. Xoá ảnh (qua `AppConfirmDialog`) ⇒ `removeAttachment` rồi `_loadAnh`. Huỷ đơn (dialog) ⇒ `cancel(orderId, reason)` ⇒ dialog pop `true` ⇒ `_load()` (**có** skeleton). Xuất kho (sheet) ⇒ `issueStock`; lỗi ⇒ `getStockIssue` (onReload); thành công ⇒ pop `true` ⇒ `_loadStockIssue()` | `_order`, `_steps`, `_buocKeTiep`, `_coTheHuy`, `_versions`, `_state {loading, ready, error, notFound}`, `_tab`; Ảnh: `_anh`, `_photoBytes` (Map, **xoá sạch** đầu mỗi lần tải lại), `_anhState`, `_anhDaMo`, `_anhDaChon` (XFile chưa gửi), `_anhLatest`; `_stockIssue`, `_stockIssueLatest` | **Đọc lại im lặng (10.8):** `_openThenReload` ⇒ `_load(showSkeleton: false)` + `_loadStockIssue()` (nếu có quyền) + `_loadAnh()` (nếu đã mở tab Ảnh); `silent = !showSkeleton && _state == ready` ⇒ không skeleton, **lỗi ⇒ giữ dữ liệu cũ** (`if (… || silent) return`). `NOT_FOUND` theo `error.code` ⇒ `notFound` riêng. `getStockIssue` lỗi ⇒ `_stockIssue = null` (khung biến mất, không báo lỗi). `addAttachments` lỗi ⇒ `_anhState = error`, **giữ** `_anhDaChon`. Sheet xuất kho tự giữ `_sending/_error/_lineErrors/_view`, `PopScope(canPop: !_sending)`. Dialog huỷ tự giữ `_lyDo/_loi/_dangGui`, `PopScope(canPop: !_dangGui)`, chặn lý do rỗng (trim) |
| `OrderStatusChangeScreen({key, required port, required orderId, onBack, ValueChanged<String>? onDone, pick})` (444) | `initState`: `getLifecycle` (vé `_latest`) ⇒ ready ⇒ `_selectStep(một bước ? event : null)`. Chọn "Đã giao" (`kEventDelivered`) ⇒ `getStockIssue` (vé `_stockIssueTicket`, `.then/onError`). "Xác nhận" ⇒ `transition(orderId, chon, files)`; lỗi + Đã giao ⇒ `getStockIssue` lại | `_steps`, `_chon`, `_anh` (List `_AnhDaChon` = XFile + AppUploadItem), `_seq`, `_state`, `_dangGui`, `_loiGui`, `_lineErrors`, `_stockIssue`, `_previewState` (null/loading/ready/error) | `_selectStep` **luôn** `++_stockIssueTicket` và xoá `_stockIssue/_lineErrors/_loiGui/_previewState` dù không phải Đã giao. Nút xác nhận null khi: chưa chọn, đang gửi, Đã giao mà preview chưa ready, hoặc `_willIssue && blocked`. Lỗi: `OrderPortException.message` nguyên văn, khác ⇒ `'Không chuyển được trạng thái.'`; `_lineErrors = rowErrors(error)`. Thành công ⇒ `_dangGui=false` rồi `onDone(status.json ?? '')`. Lỗi tải ⇒ `AppErrorState('Không chuyển được trạng thái.')` |
| `DiscountApprovalScreen({key, required OrdersPort ordersPort})` (397) | `initState`: `listPendingDiscounts`; Đồng ý/Từ chối (qua `AppConfirmDialog`) ⇒ `resolveDiscount(orderId, ResolveDiscountInput(approve, reason: text.isNotEmpty ? text : null))` (**không trim**) ⇒ ok ⇒ bỏ chọn + xoá `_reasonCtl` ⇒ `await _load()` | `_items`, `_state`, `_selected`, `_error`, `_reasonCtl`, `_reasonError`, `_resolveBusy` | **Không** vé, **không** kiểm `mounted` sai lệch (có `if (!mounted)`). Lỗi resolve ⇒ chỉ banner (`message` hoặc `'Không thực hiện được. Thử lại.'`), **giữ** danh sách + lựa chọn; `finally` ⇒ `_resolveBusy=false` (sau cả `_load`). Từ chối với lý do rỗng (trim) ⇒ `'Lý do là bắt buộc khi từ chối chiết khấu.'`, **không** mở dialog, 0 request. Chạm item ⇒ chọn + xoá `_reasonError` + `_reasonCtl.clear()`. `kOrdersTabIndex = 1` khai ở file này, 3 màn đơn khác import |
| `CreateQuoteScreen({key, required ordersPort, required catalogPort, required customersPort, perms, onDone, shareImpl})` (1361) | Bước 1 (`_order == null`): nhúng `CustomerPickScreen(port: widget.customersPort, onSelect: _createOrder)`; `create(CreateOrderInput(customerPhone: picked.phone))`. Mọi đường đọc lại dòng đi qua `_refreshTotals(fetched)` = **gọi `getStockCheck` trước (không await)** rồi `previewTotal(PreviewTotalInput(lines echo, vatMode echo, discountAmount nếu chiết khấu hiệu lực))`. `_refresh` = `get` rồi `_refreshTotals`. Dòng: `addLine` (danh mục/gói/tự do), `updateLine` (qty/unitPrice/warrantyMonths), `removeLine` ⇒ `_refresh`. `updateScopeFlags` (**không** preview). `updateOrderMeta` ⇒ `_refreshTotals`. `confirmOrder` ⇒ `onDone(confirmed)`. `reviseOrder`, `applyDiscount` ⇒ `_refreshTotals`. `exportQuote` ⇒ `share([ảnh, pdf], title, fileNames)`. Sheet: `catalogPort.listProducts()` (mở) + `listProducts(search)` mỗi phím (lỗi nuốt), `listGroups()`, `getGroup(id)` | `_order`, `_customer`, `_totals`, `_latestTotals`, `_stockCheck`, `_latestStock`, `_error`, `_fieldErrors`, 6 cờ busy (`_scopeBusy/_metaBusy/_chotBusy/_moLaiBusy/_discountBusy/_shareBusy`), 9 controller, `_addedByProduct` (productId → lineId của phiên sheet gói), `_sheetGroupDetail` | Lỗi qua `_showError`: `OrderPortException` ⇒ `message` + `fieldErrors`, khác ⇒ `'Không thực hiện được. Thử lại.'` + `{}`; **không bao giờ xoá `_order`**. Preview lỗi ⇒ `_totals = null` ("—") + `_showError`. Stock-check lỗi ⇒ `_stockCheck = null`, **không** banner. `_syncMetaTexts(order)` (gán text 2 controller kWp/hiệu lực) đúng 4 điểm: sau tạo đơn, sau `updateMeta` ok (order mới), sau `updateMeta` lỗi (order **cũ** — revert), sau `reviseOrder` ok. `_commitKWp`: rỗng ⇒ PATCH `kWp: null` chỉ khi đang có; `double.tryParse(raw.replaceAll(',', '.'))` hỏng ⇒ `fieldErrors['kWp'] = 'Công suất phải là số (vd 8,82).'`, 0 request; bằng giá trị cũ ⇒ 0 request. `_addFreeLine`: xoá `_fieldErrors` trước, `int.tryParse(...) ?? 0`, ok ⇒ reset 5 controller (`'1'`, `'0'`), sheet đóng chỉ khi `true`. `_confirmOrder` ok ⇒ `onDone` (sau `mounted`). Share: `_error = null` sau khi share xong; user huỷ share sheet không phải lỗi. Chiết khấu hiệu lực = `status != 'baogia'` và discount `cho_duyet|dong_y` |

`stock_issue_preview.dart` (151, không state, `rowErrors()` top-level) **giữ nguyên**. Nơi dựng màn (không sửa): `mobile/lib/app/signed_in_app.dart:156-218` — `OrderListScreen(reloadSignal: _ordersReload, …)`, `CreateQuoteScreen(onDone: pop rồi push chi tiết rồi `_reloadOrders`)`, `OrderStatusChangeScreen(onDone: (_) => back(context))`.

### 2. Khuôn chốt cho cả 5 màn (giống 11.2 §8.3 `CustomerPickCubit`)

**Cubit là field của `State`**: `late final XCubit _cubit = XCubit(...)`; tải đầu trong `initState`; `build` bọc `BlocProvider.value(value: _cubit, child: BlocBuilder<XCubit, XState>(builder: …))`; `dispose()` gọi `_cubit.close()`. Lý do (một dòng vào proposal §9): (1) cả 5 màn gọi cubit **sau `await`** của điều hướng/dialog (`_openThenReload`, `showAppDialog`, `showAppSheet`); (2) sheet/dialog là **route overlay riêng**, `context` của nó không nằm dưới `BlocProvider` của màn — closure trong sheet dùng `_cubit` trực tiếp; (3) `reloadSignal.addListener(_cubit.load)` cần cubit ngay ở `initState` (tear-off cùng instance ⇒ `removeListener` khớp).

**Getter riêng đọc state, giữ đúng tên guard ghim.** Text-guard ghim **tên field render** (`_coTheHuy`, `_buocKeTiep`, `_steps`, `_stockIssue!.blocked`, `_totals!.vatRate`, `_error!`…). Màn khai getter private đọc `_cubit.state` (vd `bool get _coTheHuy => _cubit.state.canCancel;`) và **chỉ dùng trong `build`/hàm render được gọi từ `BlocBuilder`** (đọc ngoài builder = render state cũ). Nhờ vậy **neo render của guard giữ nguyên chữ**. Comment một dòng trên nhóm getter (tiếng Anh): render reads the cubit state; names kept because design-system guards pin them. Không dùng biến cục bộ có `_` (lint `no_leading_underscores_for_local_identifiers` của `flutter_lints` ⇒ analyze bẩn).

**State thuần UI ở lại `State` (§6.9)**: controller/focus; `_tab` (chi tiết đơn); `_anhDaChon` (XFile đã chọn, chưa gửi) của chi tiết đơn; `_anh` + `_seq` (ảnh bằng chứng) của chuyển trạng thái; `_addedByProduct` + `_sheetGroupDetail` (sổ ghi của **một phiên sheet gói**, không render ngoài sheet) của tạo báo giá. Mọi thứ đến từ port/gửi tới port + cờ tải/gửi/lỗi ⇒ cubit.

**Overlay giữ trạng thái gửi của chính nó** (lệch §6.9 có lý do, ghi proposal §9): `_StockIssueSheet` và `_HuyDonDialog` **giữ nguyên State** (`_sending/_error/_lineErrors/_view`, `_lyDo/_loi/_dangGui`) vì `PopScope(canPop:)` cần cờ đồng bộ trong route overlay; callback của chúng đổi từ `widget.port.x(...)` sang method cubit **chuyển tiếp lời gọi port và ném lại lỗi** (`Future<OrderStockIssueResult> issueStock()`, `Future<OrderStockIssueView?> stockIssueForSheet()` (lỗi ⇒ `null`), `Future<void> cancel(String reason)`). Guard `stock-issue.test.mjs` ghim `_sending || _view.blocked ? null` trong sheet ⇒ giữ được.

Comment đầu file mới `// hand-authored — … (Story 11.3, moved out of XScreen's State).`; field port tên **`_port`** (list/detail/status-change) và **`_ordersPort`/`_catalogPort`** (discount, create-quote) — guard đòi chuỗi con `port.list(`, `port.get(`, `ordersPort….create(`, `catalogPort….listProducts(`, `ordersPort.getStockCheck(`; `if (isClosed) return …;` (cùng vé khi có) trước **mọi** `emit` sau `await`, cả `catch`; câu tiếng Việt **byte-for-byte**; constructor public 5 màn **giữ nguyên chữ ký** (vẫn `const`). Cubit mặc định, không `Bloc` (§6.4: không có chuỗi sự kiện cần event class; vé đủ).

### 3. Thiết kế từng màn (YOLO — mỗi quyết định có lý do)

**D1 — `OrderListCubit` + `OrderListState`.** Một class + `status` (giữ dòng cũ khi tải lại, như `CustomerListState` §8.2). State `{OrderListStatus status; List<OrderListItem> items; int page; int total; int pageSize; String filter}`; hằng `kOrderFilterAll = 'ALL'`, `kOrderFilterFollowUp = 'FOLLOW_UP'` public ở `order_list_state.dart` (thay `_kAll/_kFollowUp`). Cubit: field `_filter`, `int _page = 1`, `int _latest = 0`; `load()` y `_load` cũ (`if (isClosed || ticket != _latest) return;` ở cả `try`/`catch`); `setFilter(String f)` ⇒ `_filter = f; _reloadFromFirstPage();`; `_reloadFromFirstPage()` chứa câu **`_page = 1;`** đứng riêng một dòng (neo guard siết, bẫy 4); `goToPage(int p)`. Loading phải **copy items/page/total/pageSize/filter cũ** (khuôn 11.2). Màn: `initState` ⇒ `widget.reloadSignal?.addListener(_cubit.load); _cubit.load();`; `didUpdateWidget`/`dispose` remove; `_openThenReload(open)` ⇒ `await open(); if (!mounted) return; _cubit.load();`.

**D2 — `OrderDetailCubit` + `OrderDetailState`.** Một class + `status` (`OrderDetailStatus {loading, ready, error, notFound}`; lý do lệch sealed: đọc lại im lặng giữ dữ liệu cũ khi lỗi ⇒ dữ liệu sống qua mọi pha). State `{status; Order? order; steps; nextSteps; bool canCancel; versions; OrderStockIssueView? stockIssue; OrderDetailStatus photosStatus; List<AttachmentItem> photos; Map<String, Uint8List> photoBytes}` (map **bản sao mới** mỗi emit — state bất biến; Equatable so map theo nội dung). Constructor `OrderDetailCubit(OrdersPort port, String orderId, {required bool loadsStockIssue})` — màn tính `_canSeeStockIssue` (giữ getter + `AppPermissionKeys` ở màn để render khung) và truyền bool. Method:
- `load({bool showSkeleton = true})` = `_load` cũ từng dòng (`silent`, `Future.wait([...])`, `if (isClosed || ticket != _latest || silent) return;` trong `catch`, `error is OrderPortException && error.code == 'NOT_FOUND'`).
- `reloadAfterReturn()` = phần sau `await open()` của `_openThenReload`: `load(showSkeleton: false)`; `if (_loadsStockIssue) loadStockIssue()`; `if (_photosOpened) loadPhotos()` (không await, như cũ).
- `loadStockIssue()` (vé, lỗi ⇒ `stockIssue: null`); `openPhotos()` (lần đầu ⇒ `_photosOpened = true; loadPhotos()`); `loadPhotos()` (vé `_photosLatest`; emit loading + `photoBytes: const {}`; list; rồi bytes **tuần tự**, mỗi ảnh một emit, lỗi một ảnh ⇒ bỏ qua; `if (isClosed || ticket != _photosLatest) return;` trước mọi emit).
- `Future<bool> addPhotos(List<XFile> files)`: lỗi ⇒ emit `photosStatus: error`, trả `false`; ok ⇒ **`unawaited(loadPhotos())` rồi trả `true`** (giữ thứ tự cũ: màn xoá `_anhDaChon` **trước** khi tải lại xong). `removePhoto(id)` (lỗi ⇒ photos error; **không** kiểm `isClosed` giữa remove và load như cũ — nhưng mọi emit vẫn qua `isClosed`).
- Overlay: `cancel(reason)` (ném lại), `issueStock()` (ném lại), `stockIssueForSheet()` (lỗi ⇒ `null`).
- Màn: `_moTab(key)` ⇒ `setState(() => _tab = key); if (key == _kTabAnh) _cubit.openPhotos();`; `_hoiHuyDon` ⇒ `onConfirm: (reason) => _cubit.cancel(reason)`; `daHuy == true && mounted` ⇒ `_cubit.load()` (**có** skeleton như cũ); `_openIssueSheet` ⇒ `issued == true && mounted` ⇒ `_cubit.loadStockIssue()`; "Thêm ảnh" ⇒ `if (await _cubit.addPhotos(gui) && mounted) setState(() => _anhDaChon = const [])` — **chú ý**: cũ chặn `_anhDaChon.isEmpty` ở đầu; giữ. Getter: `_order`, `_steps`, `_buocKeTiep`, `_coTheHuy`, `_versions`, `_stockIssue`, `_anh`, `_photoBytes`, trạng thái.

**D3 — `OrderStatusChangeCubit` + `OrderStatusChangeState`.** Một class: `{status (loading|ready|error); List<OrderNextStep> steps; String? selected; OrderStockIssueView? stockIssue; OrderStatusChangeStatus? previewStatus; bool sending; String? sendError; Map<int, String> lineErrors}`; `copyWith` có sentinel để xoá về `null` (đừng `x ?? this.x`). Cubit: `load()` (vé `_latest`; ok ⇒ emit ready rồi `selectStep(steps.length == 1 ? steps.first.event : null)`); `selectStep(String? event)` (luôn `++_stockIssueTicket`, xoá 4 field, Đã giao ⇒ `loadPreview()`); `loadPreview()` (vé); `Future<String?> submit(List<XFile> files)` — `selected == null` ⇒ `null`, 0 request; lỗi ⇒ message/`rowErrors(error)` + nếu Đã giao ⇒ `loadPreview()`; ok ⇒ emit `sending: false` rồi trả `status.json ?? ''`; đã đóng ⇒ `null`. Cubit import `stock_issue_preview.dart show rowErrors` (không dời helper — file này giữ nguyên; ghi proposal §9). Getter màn: `_steps`, `_chon`, `_stockIssue`, `_willIssue`, `_dangGui`, `_loiGui`, `_lineErrors`, `_previewState`. Màn: `_gui()` ⇒ `final String? status = await _cubit.submit(_anh.map((a) => a.file).toList()); if (status != null && mounted) widget.onDone?.call(status);`. `onTap: _dangGui ? null : () => _cubit.selectStep(step.event)`.

**D4 — `DiscountApprovalCubit` + `DiscountApprovalState`.** Một class `{status; items; DiscountPendingItem? selected; String? error; String? reasonError; bool resolveBusy}` + `copyWith` sentinel. Cubit field **`_ordersPort`**; `load()`, `select(item)` (xoá `reasonError`), `requireReason()` (đặt `'Lý do là bắt buộc khi từ chối chiết khấu.'`), `clearReasonError()`, `Future<bool> resolve(bool approve, String reasonText)` — y `_resolve` cũ: busy; port với `reason: reasonText.isNotEmpty ? reasonText : null`; ok ⇒ emit `selected: null, reasonError: null, error: null` ⇒ `await load()` ⇒ busy false ⇒ `true`; lỗi ⇒ **chỉ** `error` ⇒ busy false ⇒ `false`. Màn: `_openRejectDialog` **ở màn** (guard ghim: kiểm `_reasonCtl.text.trim().isEmpty`, không gọi port) ⇒ rỗng ⇒ `_cubit.requireReason(); return;` ⇒ `_cubit.clearReasonError()` ⇒ dialog; `onConfirm` gọi hàm màn **tên khác `_resolve`** (vd `_decide(bool approve)`: `if (await _cubit.resolve(approve, _reasonCtl.text) && mounted) _reasonCtl.clear();` — ô lý do đã biến khỏi cây vì `selected == null`, nên xoá muộn hơn bản cũ không ai thấy; ghi Completion Notes). Chạm item ⇒ `_cubit.select(item); _reasonCtl.clear();`.

**D5 — `CreateQuoteCubit` + `CreateQuoteState`.** Lớn nhất — làm **cuối**.
- State một class + `copyWith` sentinel: `{Order? order; Customer? customer; OrderTotals? totals; OrderStockCheck? stockCheck; String? error; Map<String, String> fieldErrors; bool scopeBusy, metaBusy, confirmBusy, reviseBusy, discountBusy, shareBusy; int metaSyncSeq; Order? metaSyncFrom}`.
- Cubit `CreateQuoteCubit({required OrdersPort ordersPort, required CatalogPort catalogPort})`, field `_ordersPort`, `_catalogPort`, `_latestTotals`, `_latestStock`. Private: `_fail(Object err)` (= `_showError`), **`_refreshTotals(Order fetched)`** (tên + tham số `fetched` giữ: guard ghim `_refreshTotals(` trong `updateMeta` và `PreviewTotalInput(…vatMode: fetched.vatMode`), `_refreshStockCheck(String orderId)`, `_syncMeta(Order source)` (emit `metaSyncSeq + 1`, `metaSyncFrom: source`).
- Public, mỗi cái y bản cũ: `refresh()`, `createOrder(Customer picked)` (`CreateOrderInput(customerPhone: picked.phone)` nguyên chữ), `updateMeta(UpdateOrderMetaInput input)`, `commitKWp(String text)` (`replaceAll(',', '.')`), `commitValidityNote(String text)`, `Future<String?> addCatalogLine(String productId, int qty)`, `Future<bool> addFreeLine({required String name, unit, qtyText, unitPriceText, note})` (`int.tryParse(x) ?? 0`, `note.isNotEmpty ? note : null`), `updateQty`, `updateUnitPrice`, `updateWarranty`, `removeLine`, `toggleScope(UpdateScopeFlagsInput input)`, `Future<Order?> confirmOrder()`, `reviseOrder()`, `applyDiscount({required String amountText, required String note})`, `shareQuote(AppShareFn share)` (dựng 2 `XFile.fromData` + `fileNames` như cũ; màn truyền `widget.shareImpl ?? platformShareXFiles`), catalog: `Future<List<CatalogProduct>?> openCatalog()` (lỗi ⇒ `_fail`, `null` ⇒ không mở sheet), `Future<List<CatalogProduct>?> searchProducts(String q)` (lỗi ⇒ `null`, **không** `_fail` — cũ nuốt), `Future<List<CatalogGroup>?> openGroups()`, `Future<CatalogGroupDetail?> openGroup(String id)` (lỗi ⇒ `_fail`).
- **Đồng bộ ô metadata** (controller ở `State`): màn bọc `BlocListener` (`listenWhen: (a, b) => a.metaSyncSeq != b.metaSyncSeq`) ⇒ `_syncMetaTexts(b.metaSyncFrom!)`. Cubit gọi `_syncMeta` đúng 4 điểm bảng §1 (revert lỗi `updateMeta` truyền order **cũ** — seq vẫn tăng nên listener chạy dù order không đổi). Lý do không trả giá trị: `updateMeta` cũ sync **trước** `await _refreshTotals`; trả `Future<Order?>` sẽ sync sau khi preview về.
- Màn: `onSelect: (Customer picked) => _cubit.createOrder(picked)`; `_tickGroupItem(productId, checked)` **ở màn** (sổ `_addedByProduct`; guard ghim `_tickGroupItem(item.productId`) gọi `_cubit.addCatalogLine` / `_cubit.removeLine`; `_openFreeLineForm` đọc `_cubit.state.fieldErrors` trong `StatefulBuilder` và reset 5 controller khi `addFreeLine` trả `true`; `_openDiscountDialog` ⇒ `_cubit.applyDiscount(amountText: _discountAmountCtl.text, note: _discountNoteCtl.text)`; `_confirmOrder` hàm màn **không** đặt tên `_confirmOrder`/`_toggleScope`/`_updateMeta`/`_refresh…` (bẫy 2) ⇒ `final Order? c = await _cubit.confirmOrder(); if (c != null && mounted) widget.onDone?.call(c);`; getter `_order`, `_customer`, `_totals`, `_stockCheck`, `_error`, `_fieldErrors`, 6 cờ busy (tên cũ). `_shortStock`/`_stockHintOf` (map `status` → nhãn, có `s.status.json == kStockCheckShort`) **ở màn** (render).
- `CustomerPickScreen` nhúng giữ nguyên (11.2 đã chuyển; vòng đời dựng lại khi `_error` đổi giữ y).

**D6 — Guard `no_port_call_in_screens_test.dart`.** Xoá đúng 5 entry `'11.3'` khỏi `notMigrated` (còn 6). Không đổi detector. `*_state.dart` mới cũng bị cấm gọi port.

**D7 — Text-guard (9 file).** Đổi mọi chỗ đọc **file màn** sang `readMobileScreen(repoRoot, …)`: `orders.test.mjs` (`mobile`), `orders-list.test.mjs`, `order-detail.test.mjs`, `order-transition.test.mjs` (**2 chỗ**: `mobile` + `mobileDetail` dòng 202), `order-cancel.test.mjs`, `order-attachments.test.mjs`, `discount-approval.test.mjs`, `quote-stock-check.test.mjs`, `stock-issue.test.mjs` (2 entry `*_screen.dart` trong `MOBILE`; `stock_issue_preview.dart` **giữ `read`** — helper ném với file không phải `*_screen.dart`). Giữ `existsSync(MOBILE_*)`. `assertCodeNotBlind` floor giữ. Neo **render** giữ nguyên nhờ getter (§2). Neo **logic** ghim tên method private của màn phải trỏ sang method cubit — bảng sửa duy nhất được phép (mỗi dòng một mutant ở AC 9):

| File:dòng | Neo hôm nay | Neo mới (chặt như cũ hoặc hơn) |
|---|---|---|
| `orders.test.mjs:420` | `/Future<void> _toggleScope[\s\S]*?\n  \}/` | `/Future<void> toggleScope\(UpdateScopeFlagsInput input\)[\s\S]*?\n  \}/` (body vẫn cấm `previewTotal|_refreshTotals`) |
| `orders.test.mjs:446` | `/Future<void> _updateMeta[\s\S]*?\n  \}/` | `/Future<void> updateMeta\(UpdateOrderMetaInput input\)[\s\S]*?\n  \}/` (vẫn đòi `_refreshTotals\(`) |
| `orders.test.mjs:485` | `AppErrorState\(message: _error!, onRetry: _refresh\)` | `AppErrorState\(message: _error!, onRetry: _cubit\.refresh\)` |
| `orders.test.mjs:488` | `!/catch[^}]*_order = null/` | giữ **và thêm** `!/catch[^}]*order: null/` (shape của `copyWith` trong cubit) |
| `orders-list.test.mjs:113` | `/!mounted/` | `/if \(isClosed \|\| ticket != _latest\) return;/` |
| `orders-list.test.mjs:125` | `/_page = 1/` (**mù**: khớp khai báo `int _page = 1;` — y lỗi H-1 review 11.2) | `/^\s*_page = 1;/m` |
| `order-detail.test.mjs:153` | `includes('!mounted')` | `/if \(isClosed \|\| ticket != _latest \|\| silent\) return;/` |
| `discount-approval.test.mjs:197-199` | `_resolve\(bool approve\)` + cấm `catch…(_items = |_selected = null)` | `/Future<bool> resolve\(bool approve, String reasonText\)[\s\S]*?\n  \}/` + cấm `/catch[\s\S]*?(?:items:|selected:)/` |
| `discount-approval.test.mjs:202` | `AppErrorState\([\s\S]{0,120}?onRetry: _load` | `AppErrorState\([\s\S]{0,120}?onRetry: _cubit\.load` |

Chỗ nào khác đỏ sau khi chuyển ⇒ **sửa code cho khớp neo**, không sửa neo; nếu thật sự không thể ⇒ thêm dòng vào bảng trên trong proposal §9 kèm mutant, báo trong Completion Notes. Không sửa `parity.test.mjs`, `money-render-guard.test.mjs`, `permission-keys.test.mjs`, `read-mobile-screen.mjs`.

### 4. 🔥 BẪY — đọc kỹ

1. **Helper nối file: màn đứng ĐẦU, `indexOf`/`exec` lấy khớp ĐẦU TIÊN.** `order-detail.test.mjs` cắt `mobileCode.slice(0, indexOf('Huỷ đơn'))`, `indexOf("'Thanh toán'")`…; `quote-stock-check.test.mjs` tách theo `'Chốt báo giá'` và cấm `/stock/i` trong **400 ký tự trước** mỗi lần xuất hiện ⇒ đừng đặt code có chữ `stock` (getter `_stockCheck`, `_shortStock`…) ngay trước `_openChotDialog` / nút Chốt; đừng viết các nhãn đó trong cubit/state (kể cả chuỗi lỗi). Comment thì bị strip.
2. **Màn KHÔNG được giữ method trùng tên neo logic** (`_toggleScope`, `_updateMeta`, `_resolve(bool approve)`, `_refresh`, `_load`): regex `…[\s\S]*?\n  \}` khớp **wrapper ở màn trước** (màn đứng đầu) ⇒ kiểm body trên wrapper rỗng ⇒ **xanh giả**. Gọi thẳng `_cubit.x(...)` hoặc đặt tên khác.
3. **Đếm `pump()` (memory `cubit-emit-no-frame-single-pump`).** `order_list_screen_test.dart:216-220` "out-of-order": `complete()` Completer rồi **một** `pump()` — tín hiệu không-phải-tap; `order_status_change_screen_test.dart:342`, `order_detail_screen_test.dart:391` (Completer). 11.1 đỏ ở đúng dạng này, 11.2 không. Nếu đỏ ⇒ **sửa code** (vd lên lịch frame khi emit như `ListenableBuilder` ở `PnsApp` §7.4), **không sửa test**; ghi cách sửa proposal §9.
4. **Vé chống sai thứ tự phải test bằng câu trả lời KHÁC nhau** (memory `equatable-dedupe-hides-stale-ticket`, §8.7): Equatable bỏ qua emit trùng ⇒ fake trả cùng dữ liệu thì bỏ kiểm vé vẫn xanh. Mỗi vé (list `_latest`, detail `_latest`/`_photosLatest`/`_stockIssueLatest`, status `_latest`/`_stockIssueTicket`, quote `_latestTotals`/`_latestStock`) cần ca bloc_test hai `Completer` trả **khác nhau**, cũ về sau mới ⇒ chỉ mới hiện; cả nhánh lỗi muộn. Mutant bỏ kiểm vé ở `try` và ở `catch` ⇒ ĐỎ.
5. **Đóng sớm cả nhánh lỗi** (memory `cubit-close-error-path-untested`): mỗi cubit ca thành-công-sau-close **và** lỗi-sau-close; mutant nhắm `isClosed` trong `catch`.
6. **Carry-over sweep** (memory `cubit-carry-over-field-sweep`, review 11.2: 13/34 mutant sống): `copyWith`/dựng state giữ field cũ ở mọi emit — seed bloc_test với **mọi field khác mặc định** (vd `fieldErrors` có sẵn, `totals` có sẵn, `stockCheck` có sẵn, `pageSize: 10`, `filter` khác ALL) rồi sweep xoá từng `x: state.x` ⇒ mỗi mutant ĐỎ. Bất biến k ("lỗi không xoá giỏ") **chính là** carry-over của `order` trong mọi `catch`.
7. **Neo dương có thể khớp khai báo** (memory `text-guard-anchor-matches-field-initializer`): khi tự viết neo mới, mutant chỉ sửa **câu lệnh**, giữ khai báo.
8. **Generated DTO không có `==`** (11.2 §4): `Order`, `OrderTotals`, `OrderStockCheck`… so theo instance ⇒ bloc_test dùng cùng instance từ fake hoặc `isA<…>().having(...)`. Không sửa file sinh.
9. **Money guard (`orders.test.mjs:285-295`)** quét văn bản nối: regex `(unitPrice|amount|price|qty)\s*[*+\-]\s*[\w.$_]*(qty|unitPrice|amount|price)` và cấm `reduce(`, `* 8`, `0.08`, `~/ 100` — cubit không được có biểu thức kiểu `qty - 1`, `price + x`… kể cả không phải tiền; so sánh `qty < 1`, `unitPrice < 0` thì được.

### 5. Phạm vi

- **Trong:** D1–D7; `bloc_test` cho 5 cubit; ca widget tháo-màn-khi-port-chờ cho 5 màn (một file mới); proposal 2026-10-23 thêm **§9 "Quyết định khi làm 11.3"** (khuôn field+getter §2, overlay giữ cờ gửi, `rowErrors` import, `metaSyncSeq`, bảng neo D7 + neo nào phải thêm, cách sửa nếu có vì `pump()`); `sprint-status.yaml`.
- **Ngoài:** 6 màn còn allowlist (11.4); `stock_issue_preview.dart`; `customer_pick_*` (11.2 xong); `SignedInApp`/router/`app_routes.dart`; port/adapter/transport/`sparse_bodies.dart`/client sinh/fake; backend, web. Lỗi tầng port/adapter ⇒ ghi TD (§6.16). Smoke emulator thuộc 11.4 (§6.17) — ghi "chưa chạy".

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md` Story 11.3)

1. **Given** `order_list_screen.dart`, `order_detail_screen.dart` (3 State), `order_status_change_screen.dart`, `discount_approval_screen.dart`, `create_quote_screen.dart`, **When** chuyển, **Then** mỗi route một cubit (`OrderListCubit`, `OrderDetailCubit`, `OrderStatusChangeCubit`, `DiscountApprovalCubit`, `CreateQuoteCubit`; State con của chi tiết đơn dùng cubit màn hoặc giữ State thuần UI) nhận `OrdersPort`/`CatalogPort`/`CustomersPort` qua constructor; constructor public của màn giữ nguyên chữ ký; `stock_issue_preview.dart` (không state) giữ nguyên.
2. **Given** hành vi điều hướng chốt ở 10.8 (`reloadSignal` của danh sách đơn, chi tiết đơn **đọc lại im lặng** khi quay về và giữ dữ liệu nếu lỗi, callback màn con trả `Future` để màn dưới tải lại, form báo giá chốt ⇒ pop rồi push chi tiết), **When** chuyển, **Then** giữ nguyên từng điểm: `reloadSignal` vào cubit thành một lời gọi tải lại; `order_routes_test.dart` xanh không đổi.
3. **Given** giỏ hàng tạo báo giá, **When** sửa số lượng/đơn giá, **Then** tổng vẫn lấy từ `POST /orders/preview-total`, client không tính tiền (AD-2, AD-16); thứ tự và số lượng request preview giữ như cũ; body thưa (`sparse_bodies.dart`) giữ nguyên; text-guard tiền vẫn xanh.
4. **Given** chuyển trạng thái kèm ảnh, huỷ đơn kèm lý do, ảnh đính kèm, xuất báo giá + chia sẻ, chặn thiếu tồn khi xuất, **When** chuyển, **Then** hành vi giữ nguyên; test widget đơn (143 ca ở `test/screens/orders/`) xanh không đổi finder/expect/fake.
5. **Given** guard "màn không gọi port", **When** story xong, **Then** allowlist bớt đúng 5 entry (tự kiểm); đột biến thêm lại lời gọi port vào `order_detail_screen.dart` (cả dạng `widget.port` và alias cục bộ) ⇒ ĐỎ.
6. **Given** text-guard `orders.test.mjs`, `orders-list.test.mjs`, `order-detail.test.mjs`, `order-transition.test.mjs`, `order-cancel.test.mjs`, `order-attachments.test.mjs`, `discount-approval.test.mjs`, `quote-stock-check.test.mjs`, `stock-issue.test.mjs`, **When** logic dời sang cubit, **Then** guard đọc cả file cubit/state cùng thư mục; đột biến đưa phép tính trên field tiền vào `create_quote_cubit.dart` ⇒ guard tiền ĐỎ.
7. **Given** mỗi cubit, **When** `flutter test`, **Then** có `bloc_test`: đầu, thành công, lỗi port, đóng sớm; thêm ca riêng cho đọc lại im lặng (lỗi ⇒ giữ dữ liệu cũ) và preview-total về sai thứ tự (chỉ kết quả mới nhất được hiện).
8. **Given** 5 lane, **When** story commit, **Then** mobile + design-system xanh, `flutter analyze` sạch.

### AC dẫn xuất (đo được)

9. **Đột biến text-guard** (AC 6; `cp` backup, không `git checkout`), mỗi cái ⇒ ĐỎ đúng guard: (a) `final int t = line.unitPrice * line.qty;` (dùng `t` để compile) vào `create_quote_cubit.dart` ⇒ `orders.test.mjs` (tiền); (b) `~/ 100` trên một số vào `create_quote_cubit.dart` ⇒ `orders.test.mjs`; (c) `.reduce(` vào cubit ⇒ ĐỎ; (d) mỗi dòng bảng D7 một mutant: thêm `_refreshTotals(updated)` vào `toggleScope` ⇒ ĐỎ; bỏ `_refreshTotals(` khỏi `updateMeta` ⇒ ĐỎ; đổi `onRetry: _cubit.refresh` thành `onRetry: _cubit.load`… (có thật thì dùng, không thì bỏ hẳn `onRetry`) ⇒ ĐỎ; thêm `order: null` vào một `catch` của cubit ⇒ ĐỎ; bỏ `isClosed ||` trong `catch` của `order_list_cubit` ⇒ `orders-list` ĐỎ; bỏ câu reset `_page = 1;` (giữ khai báo) ⇒ `orders-list` ĐỎ; bỏ `|| silent` ⇒ `order-detail` ĐỎ; thêm `selected: null` vào `catch` của `resolve` ⇒ `discount-approval` ĐỎ; (e) **xoá neo dương đã dời sang cubit** (memory `text-guard-concat-sibling-files-false-green`): `Future.wait(` → hai `await` tuần tự ở `order_detail_cubit` ⇒ `order-detail` ĐỎ; `code == 'NOT_FOUND'` → `code.startsWith('NOT_FOUND')` ⇒ ĐỎ; `picked.phone` → `picked.phone.trim()` ở `createOrder` ⇒ `orders` ĐỎ; `replaceAll(',', '.')` → `replaceAll(';', '.')` ⇒ `orders` ĐỎ; (f) `AppPerm.ordersViewAll` vào `order_list_cubit.dart` ⇒ `permission-keys.test.mjs` ĐỎ; `'xong_giao'` vào `order_status_change_cubit.dart` ⇒ `stock-issue.test.mjs` ĐỎ; `elevation` (định danh) vào `discount_approval_cubit.dart` ⇒ `discount-approval` ĐỎ; `'Không tải được chi tiết đơn.'` **đổi chữ** ở màn ⇒ `order-detail` ĐỎ. Ghi bảng (pass/fail mỗi mutant) vào Debug Log.
10. **Đột biến guard port** (AC 5, H-5) — mutant phải compile, dùng method có thật của port, mỗi biến thể một lần ⇒ ĐỎ ca "no screen outside the allowlist…": vào `order_detail_screen.dart`: (a) `widget.port.get('x');` (b) `final OrdersPort p = widget.port; p.get('x');` (c) `final f = widget.port.listVersions;` (d) `widget.port.getLifecycle.call('x');` (e) `final OrdersPort ordersPort = widget.port; ordersPort.get('x');` (f) `widget.port.get('x').then((_) {});`; thêm: (g) `widget.ordersPort.get('x');` vào `create_quote_screen.dart`; (h) `widget.catalogPort.listGroups();` vào `create_quote_screen.dart`; (i) `widget.ordersPort.listPendingDiscounts();` vào `discount_approval_screen.dart`; (j) `widget.port.list();` vào `order_list_screen.dart`; (k) `widget.port.getLifecycle('x');` vào `order_status_change_screen.dart`; (l) thêm lại `orders/order_detail_screen.dart` vào allowlist ⇒ ĐỎ ca "every allowlist entry … still calls a port". Ghi dòng `Tests:` mỗi mutant.
11. **`OrderListCubit`**: đầu loading; ok ⇒ ready + items/page/total/pageSize; ALL ⇒ `followUp: null, status: null`; Follow-up ⇒ `followUp: true, status: null`; trạng thái ⇒ `status: '<key>'`; `goToPage(2)` rồi `setFilter(x)` ⇒ lần cuối `page: 1`; sai thứ tự (bẫy 4) ok-muộn và lỗi-muộn; lỗi ⇒ error giữ items cũ; carry-over (bẫy 6); đóng sớm ok/lỗi. Thêm ca widget: `reloadSignal` bắn ⇒ đúng **một** request thêm; đổi `reloadSignal` qua `didUpdateWidget` ⇒ tín hiệu cũ không còn gọi.
12. **`OrderDetailCubit`**: `load` gọi đúng 3 request trong một `Future.wait` + `getStockIssue` chỉ khi `loadsStockIssue`; `NOT_FOUND` ⇒ notFound, lỗi khác ⇒ error; **đọc lại im lặng**: đang ready, `reloadAfterReturn` lỗi ⇒ **không** emit loading, giữ order/steps/versions cũ, status vẫn ready; ok ⇒ dữ liệu mới, không qua loading; `reloadAfterReturn` gọi `listAttachments` chỉ khi đã `openPhotos`; `openPhotos` hai lần ⇒ một lần tải; bytes tuần tự, lỗi một ảnh ⇒ các ảnh khác vẫn có; `loadPhotos` mới ⇒ `photoBytes` rỗng ngay emit đầu; `addPhotos` lỗi ⇒ photos error, trả `false`; `cancel`/`issueStock` ném lại lỗi port nguyên instance; `stockIssueForSheet` lỗi ⇒ `null`; vé ×3 (bẫy 4); đóng sớm ok/lỗi cho `load`, `loadPhotos`, `loadStockIssue`.
13. **`OrderStatusChangeCubit`**: một bước ⇒ chọn sẵn; hai bước ⇒ `selected: null`; chọn Đã giao ⇒ `getStockIssue`, previewStatus loading → ready; chọn bước khác sau Đã giao ⇒ preview muộn bị bỏ (vé) và 4 field xoá; `submit` không chọn ⇒ 0 request, `null`; ok ⇒ port nhận đúng event + file theo thứ tự, trả `status.json`; `OrderPortException` ⇒ message nguyên văn + `lineErrors` từ `fieldErrors` `lines.{i}.qty`; lỗi khác ⇒ `'Không chuyển được trạng thái.'`; lỗi + Đã giao ⇒ preview tải lại; đóng sớm `load`/`submit` ok/lỗi ⇒ `submit` trả `null`.
14. **`DiscountApprovalCubit`**: `resolve` gửi `reason` **thô** (`'  lý do  '` nguyên văn), rỗng ⇒ `null`; ok ⇒ selected/reasonError/error xoá, `listPendingDiscounts` gọi lại, busy false **sau** khi tải xong, trả `true`; lỗi ⇒ items + selected giữ, error = message, trả `false`; `requireReason` ⇒ đúng câu, 0 request; `select` xoá reasonError, giữ error; đóng sớm.
15. **`CreateQuoteCubit`**: mỗi mutation có preview ⇒ thứ tự request đúng bản cũ (log thứ tự port: vd `updateLine` → `get` → `getStockCheck` → `previewTotal`); `toggleScope` ⇒ **0** `previewTotal`; preview echo `vatMode` + `discountAmount` chỉ khi chiết khấu hiệu lực (3 ca: baogia có discount ⇒ không echo; choduyet `cho_duyet` ⇒ echo; `tu_choi` ⇒ không); **preview-total sai thứ tự** (AC 7): hai mutation, preview 1 về sau preview 2 với tổng khác ⇒ state cuối = tổng 2; preview lỗi ⇒ `totals: null` + error, **order giữ**; stock-check lỗi ⇒ `stockCheck: null`, **không** error; `commitKWp('8,82')` ⇒ `kWp: 8.82`; `'abc'` ⇒ fieldErrors kWp đúng câu, 0 request; rỗng khi đang null ⇒ 0 request; bằng giá trị cũ ⇒ 0 request; `updateMeta` lỗi ⇒ `metaSyncSeq` tăng, `metaSyncFrom` là order **cũ**; ok ⇒ `metaSyncFrom` = order mới; `addFreeLine` xoá fieldErrors trước khi gửi, `'abc'` qty ⇒ `qty: 0`, note rỗng ⇒ `null`; `confirmOrder` ok ⇒ trả order, lỗi ⇒ `null` + error; `shareQuote` gọi share với `[ảnh, pdf]`, `fileNames` đúng, lỗi export ⇒ error, share không bị gọi; `searchProducts` lỗi ⇒ `null`, state không đổi; carry-over (bẫy 6); đóng sớm ok/lỗi cho `refresh`, `createOrder`, `confirmOrder`.
16. **Tháo màn khi port còn chờ** (file mới `mobile/test/screens/unmount_while_port_pending_order_screens_test.dart`, khuôn file 11.2): list `list`, detail `get` (+ `listAttachments`), status `getLifecycle` + `transition`, discount `listPendingDiscounts` + `resolveDiscount`, quote `create` + `confirmOrder` — thay màn khỏi cây rồi port trả lời (ok và lỗi) ⇒ không ném; `transition` về muộn ⇒ `onDone` **không** gọi; `confirmOrder` về muộn ⇒ `onDone` **không** gọi; `reloadSignal` bắn sau khi tháo ⇒ 0 request.
17. **Lưới an toàn không bị đụng:** `git diff --stat 78c093e -- mobile/test/screens/orders mobile/test/app mobile/test/screens/customers` chỉ có **file mới** — 0 dòng sửa trong file test cũ; 143 ca orders + 17 ca `order_routes_test` + `signed_in_app_test` xanh. Toàn lane mobile ≥ 913 ca cũ + ca mới, xanh; design-system ≥ 510, xanh.

---

## Tasks / Subtasks

- [x] **T1 — `DiscountApprovalCubit` (AC 1, 4, 14)**: D4; `test/screens/orders/discount_approval_cubit_test.dart`. Nhỏ nhất — dựng khuôn field+getter trước. Chạy `discount_approval_screen_test.dart` + `discount-approval.test.mjs` ngay.
- [x] **T2 — `OrderListCubit` (AC 1, 2, 11)**: D1; `test/screens/orders/order_list_cubit_test.dart`; chạy `order_list_screen_test.dart` (bẫy 3: ca out-of-order một `pump()`) + `order_routes_test.dart`.
- [x] **T3 — `OrderStatusChangeCubit` (AC 1, 4, 13)**: D3; `test/screens/orders/order_status_change_cubit_test.dart`; chạy `order_status_change_screen_test.dart` + `order_stock_issue_test.dart`.
- [x] **T4 — `OrderDetailCubit` (AC 1, 2, 4, 7, 12)**: D2; `test/screens/orders/order_detail_cubit_test.dart`; chạy `order_detail_*_test.dart` (4 file) + `order_stock_issue_test.dart` + `order_routes_test.dart`.
- [x] **T5 — `CreateQuoteCubit` (AC 1, 3, 4, 7, 15)**: D5; `test/screens/orders/create_quote_cubit_test.dart` (+ helper `test/screens/orders/recording_orders_port.dart` ghi log thứ tự + `Completer` theo method, khuôn `recording_customers_port.dart`); chạy `create_quote_screen_test.dart` (49) + `quote_stock_check_test.dart` + `order_routes_test.dart`.
- [x] **T6 — Ca tháo màn (AC 16)**.
- [x] **T7 — Guard port (AC 5, 10)**: D6; chạy mutant AC 10, ghi bảng.
- [x] **T8 — Text-guard (AC 6, 9)**: D7 (9 file); chạy mutant AC 9, ghi bảng; sweep carry-over (bẫy 6) cho 5 cubit, ghi số mutant sống/chết.
- [x] **T9 — Tài liệu**: proposal §9; `project-context.md` **không** sửa (câu allowlist bỏ ở 11.4); `epics.md` chỉ sửa nếu AC thực sự đổi.
- [x] **T10 — Cổng**: `cd mobile && ~/fvm/default/bin/flutter analyze` sạch; `~/fvm/default/bin/flutter test` xanh; `cd design-system && npm test` xanh; AC 17 `git diff --stat`; `dart format -o none` CHỈ để xem (repo không áp format — không ghi file); không còn file backup; `git status --short` chỉ có file story (+ `.githooks/`, `docs/*.xlsx`, `_bmad-output/story-automator/*` chưa track — không đụng).

---

## Dev Notes

### Quyết định đã chốt — không bàn lại

- §6 proposal là luật; §7/§8 là chi tiết hoá đã áp. Đặc biệt §6.6 (port qua constructor màn), §6.7 (state Equatable; lỗi port giữ câu adapter), §6.9 (controller ở `State`), §6.10 (`isClosed`), §6.11 (thứ tự + số request), §6.12 (test cũ không đổi finder/expect/fake), §6.14 (guard đọc cubit/state, không nới regex), §6.15 (tên tiếng Anh, file cạnh màn).
- Ngôn ngữ: class/method/field/test/comment mới **tiếng Anh**; chỉ chuỗi người dùng thấy tiếng Việt. Symbol tiếng Việt có sẵn ở màn (`_coTheHuy`, `_buocKeTiep`, `_chon`, `_dangGui`, `_loiGui`, `_anh`, `_anhDaChon`, `_moTab`, `_hoiHuyDon`, `_HuyDonDialog`, `_AnhDaChon`, `_kSoAnhToiDa`…) **giữ tên** (guard ghim); không đổi tên hàng loạt.
- Đừng "tiện tay" sửa hành vi đáng ngờ: `searchProducts` không chặn sai thứ tự và gọi `setSheetState` không kiểm sheet còn mở; `removePhoto` không kiểm `mounted` giữa hai lời gọi; discount `reason` không trim; không debounce tìm sản phẩm; danh sách duyệt chiết khấu không vé. Thấy đáng sửa ⇒ ghi TD.
- `stock_issue_preview.dart`, `kOrdersTabIndex` (ở `discount_approval_screen.dart`), `kCreateTabIndex`, `kFlagLinhDong` giữ chỗ, giữ chữ ký (màn khác và guard import).

### Tình huống biên đã tính

- Danh sách đơn: `reloadSignal` bắn khi đang có request ⇒ request mới, vé bỏ cũ (như cũ). Màn bị tháo ⇒ `removeListener` trong `dispose` **trước** `_cubit.close()`.
- Chi tiết: quay về từ màn con khi lần tải đầu còn loading/error ⇒ `silent == false` ⇒ có skeleton (y cũ). Huỷ đơn thành công ⇒ tải lại **có** skeleton (khác với quay về).
- Chi tiết: mở tab Ảnh rồi rời tab, quay về từ màn con ⇒ vẫn tải lại ảnh (`_photosOpened` không reset).
- Chuyển trạng thái: bấm bước khác khi preview Đã giao đang chờ ⇒ preview về muộn bị bỏ, nút không kẹt ở "Xác nhận xuất kho…".
- Duyệt chiết khấu: lỗi resolve ⇒ banner, giữ ô lý do có chữ (controller không xoá).
- Tạo báo giá: mutation liên tiếp nhanh ⇒ tổng cũ không đè tổng mới (vé `_latestTotals`); tick VAT lỗi ⇒ checkbox về giá trị cũ (order không đổi) + banner; kWp lỗi PATCH ⇒ ô revert về order cũ qua `metaSyncSeq`.
- Tạo báo giá bước 1 lỗi tạo đơn ⇒ banner trên pick, `CustomerPickScreen` dựng lại (State mới, `listSources` gọi lại) như hôm nay.
- Equatable dedupe: emit trùng bị bỏ — không đổi gì người dùng thấy; bloc 9 cho qua emit **đầu tiên** dù bằng state khởi tạo (§8.5) ⇒ bloc_test có thể thấy thêm một `loading` đầu.

### Kiểm thử — luật dự án áp dụng trực tiếp

- `bloc_test` (`blocTest<XCubit, XState>(build:, seed:, act:, expect:, verify:)`). Fake: `FakeOrdersPort`/`FakeCatalogPort`/`FakeCustomersPort` (`lib/design_system/session/fake_*`) khi đủ; port ghi log/`Completer` viết ở test (`test/screens/orders/recording_orders_port.dart`) cho ca thứ tự + vé + đóng sớm. Không thêm `mocktail`/`mockito` (§6.2).
- Ca đóng sớm trong `testWidgets` + `await cubit.close()` có listener ⇒ treo (memory) — viết `bloc_test`/`test` thường; ca widget tháo màn theo khuôn file 11.2.
- Mutation: `cp` file ra scratchpad, `cp` ngược, `cmp`; **không `git checkout`** (code story chưa commit). zsh: bọc lệnh test trong function, in dòng tổng kết mỗi mutant (memory `zsh-command-var-no-word-split-mutation`). Chèn chuỗi tiếng Việt bằng công cụ giữ UTF-8 (memory `mutation-script-unicode-escape-mangles-vietnamese`) và `grep` lại trước khi tin XANH. Mutant phải compile (memory `mutation-must-compile-or-false-red`). Mutant xanh ⇒ kiểm có phải mutant tương đương trong fixture không (memory `mutation-semantically-equivalent-false-survivor`) trước khi kết luận test yếu.
- `dart format` ghi file kể cả `--set-exit-if-changed` ⇒ luôn `-o none`.
- Flutter: `~/fvm/default/bin/flutter`, `~/fvm/default/bin/dart`. Máy mới: `dart pub get` trong `mobile/tool/codegen` một lần trước `flutter test` (§7.1).
- Lệnh lane: `cd mobile && ~/fvm/default/bin/flutter test test/screens/orders test/app/order_routes_test.dart test/app/signed_in_app_test.dart test/screens/no_port_call_in_screens_test.dart` (hẹp) → `flutter test` (toàn bộ); `cd design-system && node --test screens/orders.test.mjs screens/orders-list.test.mjs screens/order-detail.test.mjs screens/order-transition.test.mjs screens/order-cancel.test.mjs screens/order-attachments.test.mjs screens/discount-approval.test.mjs screens/quote-stock-check.test.mjs screens/stock-issue.test.mjs money/money-render-guard.test.mjs permissions/permission-keys.test.mjs` → `npm test`.

### Previous Story Intelligence (11.2, commit `78c093e`)

- Khuôn đã chạy: `CustomerPickCubit` field-trong-State + `BlocProvider.value` + `close()` ở `dispose`; cubit trả giá trị (`Customer?`/`bool`) thay cờ one-shot, màn gọi callback khi khác null **và** `mounted` — hai lớp chặn (gỡ một lớp vẫn xanh là đúng thiết kế, §8.6).
- Review 11.2: H-1 neo `/_page = 1/` mù (khớp khai báo) — **cùng neo đó còn ở `orders-list.test.mjs:125`**, siết trong story này. M-1/M-2 carry-over + fixture trùng mặc định ⇒ xanh giả. L-1: cubit đừng import file màn (vòng cubit ↔ màn) — ở đây cubit **chỉ** được import `stock_issue_preview.dart show rowErrors` (file widget không phải màn, không vòng) và module design system/port.
- QA 11.2 thêm `menu_screens_cubit_wiring_test.dart` (bấm control ⇒ đến cubit). Tương tự **khuyến khích** `test/screens/order_screens_cubit_wiring_test.dart` nếu ca widget cũ không phủ một nút (vd "Thử lại" ở lỗi preview, Trước/Sau).
- Số lane sau 11.2: mobile **913/913**, design-system **510/510**.

### Git intelligence

- `78c093e` (11.2): đọc diff `customer_pick_screen.dart` ↔ `customer_pick_cubit.dart`, `customers.test.mjs` (đổi sang `readMobileScreen` + siết neo), `no_port_call_in_screens_test.dart` (bớt entry) để chép khuôn.
- `21302e1` (11.1): `read-mobile-screen.mjs` (helper, longest-stem), `login_cubit.dart`.
- `859b894` (10.8): router `signed_in_app.dart`, `reloadSignal`, pop-rồi-push sau Chốt — không sửa.

### Latest tech notes (đo 2026-10-23, Flutter 3.35.0 / Dart 3.9.0; lock: `flutter_bloc 9.1.1`, `bloc 9.2.1`, `bloc_test 10.0.0`, `equatable 3.0.0`)

- `emit` sau `close` ném `StateError`; `isClosed` công khai. **`BlocProvider.value` không tự đóng** ⇒ `close()` ở `dispose()`. `BlocListener(listenWhen:)` nhận (trước, sau). `emit` trùng (`==`) bị bỏ qua (trừ emit đầu tiên). Sealed + `switch` exhaustive không cần `default`.
- `unawaited(...)` từ `dart:async` cho lời gọi cố ý không chờ (lint `unawaited_futures` không bật trong `flutter_lints`, nhưng ghi rõ ý định).
- Không cần package mới. Nếu thấy cần ⇒ dừng, ghi lý do vào proposal (§6.2).

### Project Structure Notes

- File mới: `mobile/lib/screens/orders/{order_list,order_detail,order_status_change,discount_approval,create_quote}_{cubit,state}.dart` (10 file — đúng tiền tố màn, nếu sai `readMobileScreen` ném ở cả 9 guard); test: `mobile/test/screens/orders/{order_list,order_detail,order_status_change,discount_approval,create_quote}_cubit_test.dart`, `mobile/test/screens/orders/recording_orders_port.dart`, `mobile/test/screens/unmount_while_port_pending_order_screens_test.dart` (+ tuỳ chọn `order_screens_cubit_wiring_test.dart`).
- File sửa: 5 file màn; `mobile/test/screens/no_port_call_in_screens_test.dart` (bớt 5 entry); 9 file `design-system/screens/*.test.mjs` (D7); `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-23.md` (§9); `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- **Không sửa:** `mobile/lib/main.dart`, `mobile/lib/app/**`, port/adapter/transport/fake/`sparse_bodies.dart`, `mobile/lib/api/generated/**`, `stock_issue_preview.dart`, `customers/*`, 6 màn còn allowlist, mọi test cũ, `design-system/lib/read-mobile-screen.mjs`, `parity.test.mjs`, `money-render-guard.test.mjs`.
- Commit: conventional, tiếng Anh, không nhắc AI, không plan/finding ID; `git add` đường dẫn cụ thể (không `-A`); không push.

### Câu hỏi mở (không chặn dev — đã có mặc định)

- Getter-đọc-state giữ tên guard (§2) thay vì đổi neo render sang `state.x` — mặc định getter (ít đụng guard nhất, theo "không nới regex"). Đổi neo render chỉ khi getter không làm được, ghi proposal §9.
- `metaSyncSeq` + `BlocListener` (D5) thay callback/giá trị trả về — mặc định seq (giữ đúng thời điểm sync trước preview).
- `addPhotos` trả `true` trước khi tải lại xong (`unawaited`) — mặc định vậy để giữ thứ tự xoá `_anhDaChon` như cũ.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 11, Story 11.3 (dòng 788-798)]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-23.md` §6.1–6.20, §7.1–7.7, §8.1–8.8]
- [Source: `_bmad-output/implementation-artifacts/11-2-chuyen-bloc-man-khach-hang-bao-hanh-ho-so.md` — D1–D7, Debug Log, Senior Developer Review H-1/M-1/M-2/L-1]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md` AD-2, AD-10/16 (tiền), AD-12 "Luật state mobile"]
- [Source: `_bmad-output/project-context.md` — Kiến trúc code/Mobile, Testing]
- [Source: `mobile/lib/screens/orders/*.dart`, `mobile/lib/app/signed_in_app.dart:156-218`, `mobile/lib/design_system/session/orders_port.dart` (`kEventDelivered`, `kStockCheckShort`, `OrderPortException`), `mobile/lib/design_system/components/share_button.dart` (`AppShareFn`, `platformShareXFiles`)]
- [Source: `design-system/screens/orders.test.mjs:93-135,285-310,366-500`, `orders-list.test.mjs:108-126`, `order-detail.test.mjs:130-155,250-255,315-430`, `order-transition.test.mjs:196-215`, `discount-approval.test.mjs:186-228`, `quote-stock-check.test.mjs:95-110`, `stock-issue.test.mjs:150-200`, `design-system/money/money-render-guard.test.mjs:196-200`, `design-system/lib/read-mobile-screen.mjs`]
- [Source: `mobile/test/screens/no_port_call_in_screens_test.dart:16-28`, `mobile/test/screens/unmount_while_port_pending_menu_screens_test.dart`]

## Dev Agent Record

### Agent Model Used

claude-opus-5-5 (Claude Code, bmad-dev-story)

### Debug Log References

**Lane cuối (2026-10-23):** `flutter analyze` sạch · `flutter test` **1116/1116** (913 cũ + 203 mới) · `design-system npm test` **510/510** · AC 17: `git diff --stat 78c093e -- mobile/test/screens/orders mobile/test/app mobile/test/screens/customers` rỗng (chỉ file mới) · `dart format -o none` chỉ xem (repo không áp format; 33/34 file lệch kiểu cũ) · không còn backup · `git status` chỉ có file story + file chưa track có sẵn. Smoke emulator: **chưa chạy** (thuộc 11.4, §6.17).

**AC 10 — đột biến guard port** (chèn vào `dispose` của màn, compile được; lệnh `flutter test test/screens/no_port_call_in_screens_test.dart`):

| mutant | kết quả | `Tests:` |
|---|---|---|
| (a) `widget.port.get('x');` detail | ĐỎ | +18 -1 "no screen outside the allowlist…" |
| (b) `final OrdersPort p = widget.port; p.get('x');` | ĐỎ | +18 -1 cùng ca |
| (c) `final f = widget.port.listVersions; f('x');` | ĐỎ | +18 -1 |
| (d) `widget.port.getLifecycle.call('x');` | ĐỎ | +18 -1 |
| (e) `final OrdersPort ordersPort = widget.port; ordersPort.get('x');` | ĐỎ | +18 -1 |
| (f) `widget.port.get('x').then((_) {});` | ĐỎ | +18 -1 |
| (g) `widget.ordersPort.get('x');` quote | ĐỎ | +18 -1 |
| (h) `widget.catalogPort.listGroups();` quote | ĐỎ | +18 -1 |
| (i) `widget.ordersPort.listPendingDiscounts();` discount | ĐỎ | +18 -1 |
| (j) `widget.port.list();` list | ĐỎ | +18 -1 |
| (k) `widget.port.getLifecycle('x');` status | ĐỎ | +18 -1 |
| (l) thêm lại `orders/order_detail_screen.dart` vào allowlist | ĐỎ | +19 -1 "every allowlist entry … still calls a port" |

(Lần chạy đầu bọc lệnh trong `| grep` ⇒ mã thoát luôn 0 ⇒ cả 12 báo "GREEN" giả; chạy lại không pipe.)

**AC 9 — đột biến text-guard** (lệnh `node --test screens/<guard>.test.mjs`):

| mutant | guard | kết quả |
|---|---|---|
| (a) `final num t = line.unitPrice * line.qty;` vào `_refreshTotals` | orders | ĐỎ |
| (b) `lineItems.length ~/ 100` vào cubit | orders | ĐỎ |
| (c) `.reduce(` vào cubit | orders | ĐỎ |
| (d) `await _refreshTotals(updated);` vào `toggleScope` | orders | ĐỎ |
| (d) bỏ `_refreshTotals(` khỏi `updateMeta` | orders | ĐỎ |
| (d) `onRetry: _cubit.refresh` → `_cubit.reviseOrder` | orders | ĐỎ |
| (d) `emit(state.copyWith(order: null));` vào catch `toggleScope` | orders | ĐỎ |
| (d) bỏ `isClosed ||` ở catch `order_list_cubit` | orders-list | **XANH** với neo của bảng D7 ⇒ siết neo (≥ 2 lần) ⇒ ĐỎ; thêm mutant nhánh `try` ⇒ ĐỎ |
| (d) bỏ câu `_page = 1;` (giữ khai báo) | orders-list | ĐỎ |
| (d) bỏ `\|\| silent` | order-detail | ĐỎ |
| (d) `selected: null` vào catch `resolve` | discount-approval | ĐỎ |
| (e) `Future.wait(` → 3 `await` tuần tự | order-detail | ĐỎ |
| (e) `code == 'NOT_FOUND'` → `code?.startsWith('NOT_FOUND')` | order-detail | ĐỎ |
| (e) `picked.phone` → `picked.phone.trim()` | orders | ĐỎ |
| (e) `replaceAll(',', '.')` → `replaceAll(';', '.')` | orders | ĐỎ |
| (f) `AppPerm.ordersViewAll` vào `order_list_cubit` | permission-keys | ĐỎ |
| (f) `'xong_giao'` vào `order_status_change_cubit` | stock-issue | ĐỎ |
| (f) `elevation` vào `discount_approval_cubit` | discount-approval | ĐỎ |
| (f) đổi chữ `'Không tải được chi tiết đơn.'` ở màn | order-detail | ĐỎ |

**Sweep cubit (bẫy 4/5/6)** — 151 mutant trên 5 file `*_cubit_test.dart`: carry-over mọi field `copyWith` của 4 state (38) + mọi field tường minh của `OrderListCubit` (14) + vé ở `try`/`catch` từng vé + `isClosed` + nhánh logic (kWp, chiết khấu hiệu lực, echo VAT, `onAccepted`, thứ tự share, `photoBytes` reset, `silent`…). Vòng 1: 131 ĐỎ, 20 sống. Xử lý:
- 8 sống vì kỳ vọng dựng bằng **chính `copyWith` bị đột biến** (discount `reasonError`, status `stockIssue`, detail `status/order/steps/nextSteps/canCancel/versions`) ⇒ test thêm `_copy(...)` dựng field-by-field bằng constructor, độc lập với `copyWith` thật ⇒ ĐỎ. `versions` còn sống thêm một vòng vì seed `const []` = mặc định ⇒ seed danh sách thật từ fake ⇒ ĐỎ.
- 2 sống (`filter: _filter` ở emit ready/error của list) là mutant hỏng của tôi (neo thiếu `\n` ⇒ không đổi gì) ⇒ sửa mutant ⇒ ĐỎ.
- 1 sống (`catch (_)` → `on StateError` ở `stockIssueForSheet`) vì fixture ném `StateError` ⇒ đổi fixture sang `OrderPortException` ⇒ ĐỎ.
- **9 tương đương, giữ nguyên:** bỏ `isClosed` ở nhánh `try` (list load, discount load/resolve, status load/submit, quote confirm/create/refresh) và ở catch preview của quote ⇒ `emit` sau `close` ném `StateError`, lỗi bị chính `catch` (đã có `isClosed`) hoặc `catch` của caller nuốt ⇒ không emit, cùng giá trị trả. Không đo được, không phải test yếu.
- Kết quả: **142/151 ĐỎ, 9 tương đương.**

**Mutant phía màn** (31, lệnh: `test/screens/orders` + `order_routes_test` + `signed_in_app_test` + wiring + tháo màn): vòng 1 24 ĐỎ, 7 sống — đều là chỗ test widget cũ chưa phủ (xoá ảnh đã chọn sau "Thêm ảnh", đồng bộ ô kWp, xoá form dòng tự do, gọi `onDone` sau Chốt, ô tìm danh mục, bỏ tick gói). Thêm 6 ca vào `order_screens_cubit_wiring_test.dart` ⇒ 6 ĐỎ. 1 tương đương: duyệt chiết khấu không xoá ô lý do sau resolve — ô đã rời cây (`selected == null`) và chạm item lại luôn xoá ô. **30/31 ĐỎ, 1 tương đương.**

### Completion Notes List

- 5 màn đơn chuyển sang cubit theo khuôn field-của-`State` + `BlocProvider.value` (`OrderListCubit`, `OrderDetailCubit`, `OrderStatusChangeCubit`, `DiscountApprovalCubit`, `CreateQuoteCubit`); constructor public giữ nguyên; `stock_issue_preview.dart` không đổi; allowlist guard port còn 6 (11.4).
- Render đọc state qua getter riêng giữ tên cũ ⇒ không phải sửa neo render nào của text-guard. 9 text-guard đọc qua `readMobileScreen`; bảng neo D7 áp đủ, thêm một chỗ siết (orders-list `isClosed` ≥ 2 lần, xem Debug Log) và `!/catch[^}]*order: null/` ở orders.
- Lệch D5: `addFreeLine(onAccepted:)` xoá form ngay khi backend nhận dòng, **trước** khi đọc lại giỏ (giữ thời điểm cũ; xoá khi trả `true` sẽ để chữ còn trong form suốt lúc đọc lại). Duyệt chiết khấu: ô lý do xoá sau khi `resolve` xong (không ai thấy). Ghi proposal §9.6–9.7.
- Không ca widget cũ nào đỏ (cả các ca `Completer` + một `pump()`) ⇒ không cần sửa code vì frame. 0 dòng sửa trong test cũ (AC 17).
- Test mới: `bloc_test`/`test` cho 5 cubit (list 12, discount 17, status 30, detail 46, quote 67), 19 ca tháo màn khi port còn chờ (AC 16), 12 ca wiring màn ↔ cubit; port ghi log `RecordingOrdersPort` (FakeOrdersPort + log + `held`/`errors`/`answers`).
- Giữ nguyên hành vi đáng ngờ, ghi lại (không sửa): vòng bytes ảnh chi tiết đơn sang ảnh tiếp sau một ảnh lỗi kể cả khi đã đóng (một request thừa, không emit); `searchProducts` không vé; `removePhoto` không kiểm giữa hai lời gọi; mở checklist gói khi sheet đã đóng gọi `setSheetState` (bản cũ bắt lỗi và hiện banner chung). Review: bản dev để lỗi này lọt ra zone (đổi hành vi) — đã khôi phục; cả ba ghi TD-72/73/74 trong `sprint-status.yaml`.
- `project-context.md` và `epics.md` không sửa (AC không đổi).

### File List

- mobile/lib/screens/orders/create_quote_cubit.dart (mới)
- mobile/lib/screens/orders/create_quote_state.dart (mới)
- mobile/lib/screens/orders/discount_approval_cubit.dart (mới)
- mobile/lib/screens/orders/discount_approval_state.dart (mới)
- mobile/lib/screens/orders/order_detail_cubit.dart (mới)
- mobile/lib/screens/orders/order_detail_state.dart (mới)
- mobile/lib/screens/orders/order_list_cubit.dart (mới)
- mobile/lib/screens/orders/order_list_state.dart (mới)
- mobile/lib/screens/orders/order_status_change_cubit.dart (mới)
- mobile/lib/screens/orders/order_status_change_state.dart (mới)
- mobile/lib/screens/orders/create_quote_screen.dart
- mobile/lib/screens/orders/discount_approval_screen.dart
- mobile/lib/screens/orders/order_detail_screen.dart
- mobile/lib/screens/orders/order_list_screen.dart
- mobile/lib/screens/orders/order_status_change_screen.dart
- mobile/test/screens/no_port_call_in_screens_test.dart
- mobile/test/screens/orders/recording_orders_port.dart (mới)
- mobile/test/screens/orders/create_quote_cubit_test.dart (mới)
- mobile/test/screens/orders/discount_approval_cubit_test.dart (mới)
- mobile/test/screens/orders/order_detail_cubit_test.dart (mới)
- mobile/test/screens/orders/order_list_cubit_test.dart (mới)
- mobile/test/screens/orders/order_status_change_cubit_test.dart (mới)
- mobile/test/screens/order_screens_cubit_wiring_test.dart (mới)
- mobile/test/screens/unmount_while_port_pending_order_screens_test.dart (mới)
- design-system/screens/discount-approval.test.mjs
- design-system/screens/order-attachments.test.mjs
- design-system/screens/order-cancel.test.mjs
- design-system/screens/order-detail.test.mjs
- design-system/screens/order-transition.test.mjs
- design-system/screens/orders-list.test.mjs
- design-system/screens/orders.test.mjs
- design-system/screens/quote-stock-check.test.mjs
- design-system/screens/stock-issue.test.mjs
- _bmad-output/planning-artifacts/sprint-change-proposal-2026-10-23.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/11-3-chuyen-bloc-man-don-hang-va-bao-gia.md

## Senior Developer Review (AI)

**Reviewer:** Đại Ca (bmad-story-automator-review + /ck:code-review, 2 code-reviewer đọc độc lập: báo giá; chi tiết đơn + chuyển trạng thái) — 2026-10-23. **Kết quả: Approve sau khi sửa.** 0 CRITICAL; AC 1–17 đạt; task [x] đều có bằng chứng.

Lane trước sửa: analyze sạch · mobile 1127/1127 · design-system 510/510. Lane sau sửa: analyze sạch · mobile **1132/1132** · design-system **510/510** · AC 17 `git diff --stat 78c093e -- mobile/test/screens/orders mobile/test/app mobile/test/screens/customers` rỗng · không file backup.

| # | Mức | Finding | Xử lý |
|---|---|---|---|
| M-1 | MEDIUM | `create_quote_screen.dart` ô tìm danh mục: bản cũ `.then(setSheetState).catchError((_){})` nuốt cả lỗi `setSheetState` khi sheet đã đóng; bản mới bỏ `catchError` ⇒ lỗi lọt ra zone (đổi hành vi) | Khôi phục `.catchError`; ca widget "a catalogue search answered after the sheet closed…"; mutant bỏ `catchError` ⇒ ĐỎ |
| M-2 | MEDIUM | "Mở checklist": bản cũ `setSheetState` nằm trong `try` ⇒ sheet đã đóng thì banner chung + xoá `fieldErrors`; bản mới không banner, lỗi lọt ra zone (đổi hành vi người dùng thấy, dev ghi nhận nhưng không sửa) | Bọc `try` → `CreateQuoteCubit.reportError` (= `_fail`); ca widget ghim banner; mutant ⇒ ĐỎ. Hành vi đáng ngờ ghi TD-72 |
| M-3 | MEDIUM | Gửi ảnh bị từ chối ⇒ giữ ảnh đã chọn: không ca nào phủ (mọi ca gửi ảnh đều thành công) | Ca widget "Thêm ảnh refused ⇒ the picked photos stay"; mutant luôn xoá ⇒ ĐỎ |
| M-4 | MEDIUM | Luật (16): 3 hành vi đáng ngờ có sẵn dev ghi trong Completion Notes nhưng chưa có dòng TD | TD-72 (sheet gói), TD-73 (searchProducts không vé/debounce), TD-74 (request ảnh sau khi màn đóng) trong `sprint-status.yaml` |
| L-1 | LOW | `_confirmThenLeave`: `onDone` nằm ngoài `try` (bản cũ trong `try` ⇒ banner) | Bọc `try` → `reportError`; ca widget `onDone` ném ⇒ banner; mutant ⇒ ĐỎ |
| L-2 | LOW | `loadsStockIssue: _canSeeStockIssue` chỉ phủ nhánh có quyền; `true` ⇒ thừa `getStockIssue` mỗi lần quay về (vi phạm §6.11, không thấy được) | Ca widget không quyền ⇒ `(get, getStockIssue) == (2, 0)`; mutant `true` ⇒ ĐỎ |
| L-3 | LOW | Ca dòng tự do không gõ Diễn giải ⇒ bỏ `_freeNote.clear()` vẫn xanh | Gõ Diễn giải trong ca; mutant ⇒ ĐỎ |
| L-4 | LOW | Luật (8): tên group test mới tiếng Việt (`'Chi tiết đơn'`…), comment mới trộn Việt (`_decide`, `_confirmThenLeave`, `(bất biến k)`) | Group đổi sang tên class màn; comment dịch tiếng Anh. Nhãn UI trích trong comment/tên test giữ (chuỗi người dùng thấy) |
| L-5 | LOW | Comment seed carry-over của `order_status_change_cubit_test` nói "mọi field khác mặc định" nhưng `sending` mặc định | Sửa comment (ca selectStep đã seed `sending: true`) |

Không sửa (có lý do): ô kWp sau tạo đơn chỉ đo ở cubit — `BlocListener` dùng chung cho 4 điểm sync, ba điểm kia đã có ca widget; `isClosed` ở nhánh `try` là mutant tương đương (đã ghi Debug Log). YAML `sprint-status.yaml` dòng 24 (`story_location: {project-root}…` không quote) không parse bằng PyYAML từ trước story — ngoài phạm vi, khối `action_items` parse được.

**Đột biến guard design-system bổ sung (luật 15 — mẫu cấm đưa vào file cubit/state ⇒ ĐỎ)**, dev chưa ghi cho 4 guard: `onLongPress` vào `order_detail_cubit` ⇒ order-attachments ĐỎ · `elevation` vào `order_detail_state` ⇒ order-cancel ĐỎ · `'bat_dau_giao'` vào `order_status_change_cubit` ⇒ order-transition ĐỎ · `'thicong'` vào `order_status_change_state` ⇒ order-transition ĐỎ · `'dagiao'` vào `order_detail_cubit` ⇒ order-detail ĐỎ (order-transition không quét màn chi tiết — phạm vi có từ trước) · `line.qty < line.onHand` vào `create_quote_cubit` và `available - reserved` vào `create_quote_state` ⇒ quote-stock-check ĐỎ.

**Đột biến cho ca mới** (cp backup, `cmp` sau khôi phục, `flutter test test/screens/order_screens_cubit_wiring_test.dart`): bỏ `catchError` tìm danh mục · bỏ `try` "Mở checklist" · bỏ `try` `onDone` · luôn xoá ảnh đã chọn · bỏ `_freeNote.clear()` · `loadsStockIssue: true` ⇒ cả 6 `+27 -1` ĐỎ.

Luật dự án (1)(2)(3)(6)(12)(13)(14): không áp — story chỉ đụng mobile + design-system, không đường ghi backend, không tồn kho, không màn web, không e2e/smoke đăng nhập (smoke emulator thuộc 11.4, §6.17).

## Change Log

- 2026-10-23: Dev 11.3 — 5 màn đơn hàng/báo giá sang Cubit (field của State, getter giữ tên guard), allowlist guard port bớt 5 entry, 9 text-guard đọc cubit/state + siết neo orders-list, 203 ca test mới, proposal §9. Status → review.
- 2026-10-23: Code review 11.3 — khôi phục 2 đường bắt lỗi sheet báo giá + `onDone` (`CreateQuoteCubit.reportError`), 5 ca widget mới (sheet đóng khi port chờ ×2, `onDone` ném, ảnh gửi lỗi, không quyền giao hàng), gõ Diễn giải trong ca dòng tự do, đổi tên group/comment sang tiếng Anh, TD-72/73/74, proposal §9.11. Status → done.
