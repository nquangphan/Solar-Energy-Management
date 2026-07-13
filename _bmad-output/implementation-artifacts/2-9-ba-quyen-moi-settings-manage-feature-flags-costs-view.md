---
baseline_commit: a669eca96b71ca20bd9fe05ea1a8e132c00022cf
---

# Story 2.9: Ba quyền mới vào registry + role-presets + bất biến test + sinh lại `openapi/permissions.json`

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên backend**,
I want **thêm ba quyền mới (`settings.manage`, `system.feature_flags`, `costs.view`) vào registry chính tắc + cập nhật `role-presets.ts` + thêm bất biến test + sinh lại artifact**,
so that **phân quyền phủ toàn bộ nhóm tính năng mới (cấu hình danh mục E3, cờ giá phân tầng E3, giá vốn & báo cáo lợi nhuận E3/E8) TRƯỚC khi Epic 3 chạm `Product.costPrice`**.

## Acceptance Criteria

1. **AC-1 — Ba key mới append CUỐI registry, KHÔNG đổi thứ tự 17 key cũ.** **Given** ba quyền mới từ PRD §5, **When** append vào `backend/src/accounts/domain/permission-registry.ts`, **Then** thêm vào **cuối** `PERM` và **cuối** mảng `PERMISSIONS` theo thứ tự deterministic: `settings.manage` → `system.feature_flags` → `costs.view` **And** thứ tự + nội dung 17 entry cũ **giữ nguyên byte-for-byte** (thứ tự registry quyết định thứ tự artifact — AD-17, AD-12).

2. **AC-2 — `role-presets.ts` cập nhật đúng ma trận; `system.feature_flags` KHÔNG lọt vào `ADMIN_PRESET`.** **Given** `role-presets.ts`, **When** cập nhật, **Then**:
   - `costs.view` → có ở `ADMIN`, `KE_TOAN`, `QUAN_LY` (và `SUPER_ADMIN` **thừa hưởng** qua spread `ADMIN_PRESET`); **KHÔNG** ở `THO_KS`/`THI_CONG`/`KHO_GIAO`.
   - `settings.manage` → **CHỈ** ở `ADMIN` (và `SUPER_ADMIN` thừa hưởng); **KHÔNG** ở `QUAN_LY`/`KE_TOAN`/`THO_KS`/`THI_CONG`/`KHO_GIAO`. *(Quyết định Đại Ca 2026-07-13 — theo PRD §5; giải Open Question #1, xem Change Log.)*
   - `system.feature_flags` → **CHỈ** `SUPER_ADMIN`; append thẳng vào literal `SUPER_ADMIN` (cạnh `PERM.auditRead`), **TUYỆT ĐỐI KHÔNG** thêm vào `ADMIN_PRESET`.
   - **And** sửa comment sai ở `role-presets.ts:13`: câu "*một account Admin được chỉ định là Super Admin*" **SAI** → thay bằng "*`SUPER_ADMIN` = người vận hành app, ngoài tổ chức khách*" (FR-18, AC-3).

3. **AC-3 — Bất biến `system.feature_flags` có test (cùng khuôn `audit.read`).** **Given** bất biến, **When** test ở `backend/test/role-presets.spec.ts`, **Then** test khẳng định `system.feature_flags` **KHÔNG** nằm trong `ADMIN_PRESET`/preset `ADMIN`, và **đúng MỘT** preset chứa nó = `SUPER_ADMIN` — mirror ba test `audit.read` hiện có (dòng 17–34).

4. **AC-4 — Artifact `openapi/permissions.json` sinh lại từ registry.** **Given** ba key mới, **When** chạy `npm run permissions:gen`, **Then** `backend/openapi/permissions.json` chứa **20 entry** đúng thứ tự registry, và drift-guard `permissions-drift.spec.ts` (so **byte-for-byte**) xanh (AD-12 "cấm sửa tay artifact", AD-17).

**Bằng chứng "done" (hermetic — KHÔNG cần Postgres):**

- `permission-registry.spec.ts` xanh với **`PERMISSION_KEYS.length === 20`** (xem Gotcha #1 — test này đang hardcode `17`, **sẽ ĐỎ** nếu không sửa).
- `role-presets.spec.ts` xanh, **có test mới** cho `system.feature_flags` (AC-3) + `costs.view` + `settings.manage`.
- `permissions-drift.spec.ts` xanh → artifact commit khớp byte-for-byte với registry (đã chạy `npm run permissions:gen`, **không sửa tay JSON**).
- `no-permission-literal-outside-registry.spec.ts` xanh → 3 literal mới **chỉ** tồn tại trong `permission-registry.ts`; mọi nơi khác dùng `PERM.settingsManage`/`PERM.systemFeatureFlags`/`PERM.costsView`.
- `permission-registry-fe-stub-parity.spec.ts` xanh (không đổi FE stub ở story này — 3 key mới chưa có consumer FE).
- Toàn bộ **31 suite** backend vẫn xanh (0 regression); `npm run lint`, `npm run format:check`, `nest build` sạch.
- `prisma/seed.ts` **KHÔNG sửa** — nó đọc `ROLE_PRESETS.SUPER_ADMIN`, tự động nhận 3 key mới.

## Tasks / Subtasks

- [x] **Task 1 — Append 3 key vào registry (AC: 1)**
  - [x] `backend/src/accounts/domain/permission-registry.ts` — thêm vào **cuối** object `PERM` (sau `invoicesManage`), giữ nguyên 17 entry trên:
    ```ts
    /** Cấu hình hệ thống (danh mục nguồn khách, thuế suất VAT) — Story 3.5, E8. */
    settingsManage: 'settings.manage',
    /** Cờ tính năng cấp nghiệp vụ (cờ giá phân tầng FR-15) — CHỈ người vận hành app. */
    systemFeatureFlags: 'system.feature_flags',
    /** Xem giá vốn & lợi nhuận (`Product.costPrice`, báo cáo lợi nhuận gộp). */
    costsView: 'costs.view',
    ```
  - [x] Thêm vào **cuối** mảng `PERMISSIONS` (sau entry `invoicesManage`), **đúng thứ tự này**:
    ```ts
    { key: PERM.settingsManage, label: 'Cấu hình hệ thống', group: 'settings' },
    {
      key: PERM.systemFeatureFlags,
      label: 'Cờ tính năng (vận hành app)',
      group: 'system',
    },
    { key: PERM.costsView, label: 'Xem giá vốn & lợi nhuận', group: 'costs' },
    ```
  - [x] Cập nhật docstring đầu file: "Bộ key đầy đủ ánh xạ ma trận PRD FR-18 §4.6" → nhắc thêm 3 key mới từ **PRD §5** (17 → 20). KHÔNG đổi gì khác trong docstring.

- [x] **Task 2 — Cập nhật `role-presets.ts` (AC: 2)**
  - [x] Thêm `PERM.settingsManage` và `PERM.costsView` vào **`ADMIN_PRESET`** (cuối mảng) → `ADMIN` **và** `SUPER_ADMIN` (spread) cùng nhận. **KHÔNG** thêm `systemFeatureFlags` ở đây.
  - [x] Thêm `PERM.systemFeatureFlags` vào **literal `SUPER_ADMIN`**, cạnh `PERM.auditRead`:
    ```ts
    SUPER_ADMIN: [...ADMIN_PRESET, PERM.auditRead, PERM.systemFeatureFlags],
    ```
  - [x] Thêm **chỉ** `PERM.costsView` vào mảng **`QUAN_LY`**. **KHÔNG** thêm `settingsManage` — Đại Ca chốt theo PRD §5 (giải Open Question #1).
  - [x] Thêm `PERM.costsView` vào mảng **`KE_TOAN`**. **KHÔNG** thêm `settingsManage` vào `KE_TOAN`.
  - [x] **KHÔNG** đụng `THO_KS`/`THI_CONG`/`KHO_GIAO`.
  - [x] Sửa comment sai dòng ~13 (AC-2): bỏ "*¹ ghi chú FR-18: một account Admin được chỉ định là Super Admin*", thay bằng "*`SUPER_ADMIN` = người vận hành app, ngoài tổ chức khách*". Cập nhật câu bất biến để nêu **cả hai** key chỉ-SUPER_ADMIN (`audit.read` **và** `system.feature_flags`).
  - [x] Cập nhật comment mô tả từng cột preset cho khớp bộ quyền mới (vd cột "Kế toán" nay có giá vốn).

- [x] **Task 3 — Sửa test đếm key đang hardcode 17 (AC: 1, 4)**
  - [x] `backend/test/permission-registry.spec.ts:69-71` — đổi `toBe(17)` → `toBe(20)` và đổi tên test: "khai đúng **20** key chính tắc (17 ma trận FR-18 §4.6 + 3 key PRD §5)".
  - [x] Thêm assert 3 key mới khớp **byte-for-byte** (chống typo literal), cùng khuôn assert 4 key FE-stub:
    ```ts
    expect(PERM.settingsManage).toBe('settings.manage');
    expect(PERM.systemFeatureFlags).toBe('system.feature_flags');
    expect(PERM.costsView).toBe('costs.view');
    ```
  - [x] Thêm assert **thứ tự**: 17 key cũ vẫn đứng đầu, đúng vị trí (chống reorder làm vỡ artifact deterministic):
    ```ts
    expect(PERMISSION_KEYS.slice(-3)).toEqual([
      PERM.settingsManage,
      PERM.systemFeatureFlags,
      PERM.costsView,
    ]);
    expect(PERMISSION_KEYS[0]).toBe(PERM.ordersViewAll); // 17 key cũ không đổi thứ tự
    ```

- [x] **Task 4 — Bất biến `system.feature_flags` + preset mới ở `role-presets.spec.ts` (AC: 3)**
  - [x] Mirror **đúng khuôn** ba test `audit.read` (dòng 17–34):
    ```ts
    it('CHỈ SUPER_ADMIN có `system.feature_flags` — không preset nào khác', () => {
      for (const name of presetNames) {
        if (name === 'SUPER_ADMIN') continue;
        expect(ROLE_PRESETS[name]).not.toContain(PERM.systemFeatureFlags);
      }
    });

    it('đúng MỘT preset chứa `system.feature_flags` (bất biến "chỉ người vận hành app")', () => {
      const withFlags = presetNames.filter((name) =>
        ROLE_PRESETS[name].includes(PERM.systemFeatureFlags),
      );
      expect(withFlags).toEqual(['SUPER_ADMIN']);
    });
    ```
  - [x] Test **ADMIN không có** `system.feature_flags` (nêu tường minh — đây là bẫy spread, AC-3):
    ```ts
    it('ADMIN KHÔNG có `system.feature_flags` (không append vào ADMIN_PRESET)', () => {
      expect(ROLE_PRESETS.ADMIN).not.toContain(PERM.systemFeatureFlags);
    });
    ```
  - [x] Test tập preset chứa `costs.view` — **nhớ `SUPER_ADMIN` thừa hưởng qua spread**:
    ```ts
    it('costs.view ở ADMIN + KE_TOAN + QUAN_LY (+ SUPER_ADMIN thừa hưởng)', () => {
      const withCosts = presetNames.filter((name) =>
        ROLE_PRESETS[name].includes(PERM.costsView),
      );
      expect(new Set(withCosts)).toEqual(
        new Set(['ADMIN', 'KE_TOAN', 'QUAN_LY', 'SUPER_ADMIN']),
      );
    });
    ```
  - [x] Test tập preset chứa `settings.manage` (theo quyết định Đại Ca — CHỈ `ADMIN`):
    ```ts
    it('settings.manage CHỈ ở ADMIN (+ SUPER_ADMIN thừa hưởng) — không QUAN_LY/KE_TOAN', () => {
      const withSettings = presetNames.filter((name) =>
        ROLE_PRESETS[name].includes(PERM.settingsManage),
      );
      expect(new Set(withSettings)).toEqual(new Set(['ADMIN', 'SUPER_ADMIN']));
    });
    ```
  - [x] Test **role thi công/kho không thấy giá vốn** (bảo vệ dữ liệu nhạy cảm):
    ```ts
    it('THO_KS/THI_CONG/KHO_GIAO KHÔNG có `costs.view` (giá vốn là dữ liệu nhạy cảm)', () => {
      for (const name of ['THO_KS', 'THI_CONG', 'KHO_GIAO'] as const) {
        expect(ROLE_PRESETS[name]).not.toContain(PERM.costsView);
      }
    });
    ```
  - [x] Cập nhật docstring đầu file `role-presets.spec.ts`: bất biến nay gồm **hai** key chỉ-SUPER_ADMIN.

- [x] **Task 5 — Sinh lại artifact (AC: 4)**
  - [x] `cd backend && npm run permissions:gen` → `openapi/permissions.json` **tự ghi lại**. **CẤM sửa tay** file JSON (AD-12).
  - [x] Xác nhận file có 20 entry, 3 entry mới ở **cuối**, 17 entry cũ **không đổi** (`git diff` chỉ thêm dòng ở cuối mảng).
  - [x] `npm test -- permissions-drift` xanh.

- [x] **Task 6 — Verify toàn bộ (mọi AC)**
  - [x] `cd backend && npm test` → **31 suite** xanh, 0 regression.
  - [x] `npm run lint && npm run format:check && npm run build` sạch.
  - [x] `git diff --stat` — chỉ đụng **5 file** trong danh sách "File được phép sửa" bên dưới. Đụng file khác = scope-creep, dừng lại.

## Dev Notes

### Ranh giới phạm vi (đọc TRƯỚC — chống scope-creep)

Story này **chỉ** thêm 3 key + preset + test + artifact. **KHÔNG** làm những việc sau (chúng thuộc story khác):

| KHÔNG làm | Thuộc về |
|---|---|
| Guard/gate endpoint bằng 3 key mới (`@RequirePermissions`) | Story 3.1 (`costPrice`), 3.2 (cờ), 3.5 (`settings.manage`), 8.6 (báo cáo) |
| Luật không-leo-thang, source-guard `@RequirePermissions` | **Story 2.10** (story kế tiếp) |
| Ẩn `Product.costPrice` khỏi response khi thiếu quyền | Story 3.1 |
| Thêm 3 key vào FE stub web/mobile (`permissions.ts`, `app_permissions.dart`) | Chưa có màn nào tiêu thụ → **để nguyên** |
| Sửa `account-permissions.service.ts` | Story 2.10 |
| Đổi preset `audit.read`, đổi FR-20 gate-theo-quyền | Story 8.2/8.5 |
| Sửa `prisma/seed.ts` | Không cần — đọc `ROLE_PRESETS.SUPER_ADMIN`, tự nhận key mới |

**File được phép sửa (đúng 5 file):**

1. `backend/src/accounts/domain/permission-registry.ts` (UPDATE)
2. `backend/src/accounts/domain/role-presets.ts` (UPDATE)
3. `backend/test/permission-registry.spec.ts` (UPDATE)
4. `backend/test/role-presets.spec.ts` (UPDATE)
5. `backend/openapi/permissions.json` (**GENERATED** — chỉ qua `npm run permissions:gen`)

### Điểm sai kinh điển phải tránh (Gotchas)

**🔴 Gotcha #1 — `permission-registry.spec.ts:70` hardcode `17`, SẼ ĐỎ.**
```ts
it('khai đúng 17 key chính tắc từ ma trận PRD FR-18', () => {
  expect(PERMISSION_KEYS.length).toBe(17);   // ← 20 sau story này
});
```
Đây là **regression chắc chắn xảy ra**, KHÔNG nêu trong AC epics. Sửa ở Task 3. Đừng "sửa cho xanh" bằng cách xoá test — đổi số + đổi tên test.

**🔴 Gotcha #2 — `SUPER_ADMIN` spread `ADMIN_PRESET`: thêm vào `ADMIN_PRESET` là TỰ ĐỘNG cấp cho `SUPER_ADMIN`.**
```ts
SUPER_ADMIN: [...ADMIN_PRESET, PERM.auditRead],   // ← spread!
ADMIN: ADMIN_PRESET,
```
Hệ quả trực tiếp:
- `costs.view` + `settings.manage` → thêm vào `ADMIN_PRESET` là **đúng** (cả `ADMIN` lẫn `SUPER_ADMIN` đều phải có).
- `system.feature_flags` → thêm vào `ADMIN_PRESET` là **SAI HOÀN TOÀN** (`ADMIN` sẽ có nó, vỡ bất biến AC-3). Phải append thẳng vào literal `SUPER_ADMIN`.
- Khi viết test tập preset, `SUPER_ADMIN` **luôn** nằm trong kết quả `costs.view`/`settings.manage` — đừng quên nó trong `new Set([...])` (test sẽ đỏ vì thiếu phần tử, không phải vì code sai).

**🔴 Gotcha #3 — `permissions.json` là artifact SINH TỰ ĐỘNG, cấm sửa tay.**
`permissions-drift.spec.ts` regen in-memory rồi so **byte-for-byte** với file commit. Sửa tay JSON (kể cả đúng nội dung nhưng lệch format/thiếu newline cuối) = **đỏ**. Luôn `npm run permissions:gen`.

**🟡 Gotcha #4 — Cấm permission literal ngoài registry (AD-17).**
`no-permission-literal-outside-registry.spec.ts` quét `src/` (đã strip comment, **giữ string**). Trong `role-presets.ts` dùng `PERM.settingsManage` — **KHÔNG** viết `'settings.manage'`. Trong `test/` thì literal được phép (guard chỉ quét `src/`), và `permission-registry.spec.ts` **cần** literal để assert byte-for-byte.

**🟡 Gotcha #5 — Thứ tự registry = thứ tự artifact.**
`PERMISSIONS.map(...)` sinh artifact deterministic. Chèn key mới vào **giữa** mảng sẽ làm diff `permissions.json` xáo trộn và vỡ hợp đồng thứ tự cho FE (Story 2.6 gen key từ artifact này). **Append cuối, luôn luôn.**

### Kiến trúc & bất biến bắt buộc (KHÔNG vi phạm)

- **AD-17** — `permission-registry.ts` là **nơi duy nhất** chứa permission string literal; là nguồn chân lý DUY NHẤT cho FE gating + BE guard + noti resolver.
- **AD-12** — OpenAPI/artifact **sinh từ code**; cấm sửa tay spec/artifact.
- **AD-8** — RBAC **per-account**; role = **preset nạp lúc tạo account**, KHÔNG ràng buộc runtime. Đổi preset **không** hồi tố account đã tồn tại (chỉ `prisma/seed.ts` chạy lần đầu mới nạp).
- **AD-4** — Ẩn/disable ở UI **không phải bảo mật**; backend enforce mỗi request (thi hành ở Story 2.10 + các story feature).
- **AD-21 / "Đường đỏ" `settings.manage`** (ARCHITECTURE-SPINE.md:190) — `settings.manage` **KHÔNG BAO GIỜ** được gate màn phân quyền (8.2), ma trận quyền (8.4), hay audit log (8.5). Nếu không, account có `settings.manage` tự cấp cho mình mọi quyền trong một click. Story này chỉ **khai** quyền; đường đỏ được thi hành ở 2.10/8.x — **đừng** dùng `settings.manage` gate bất cứ thứ gì ở đây.
- **Domain thuần** — `permission-registry.ts` + `role-presets.ts` chỉ hằng số + type; **KHÔNG** import Prisma/Nest/Infra.

### Ranh giới ba quyền "sửa cái gì đó" (PRD §5 — dùng để đặt label/group đúng)

Câu hỏi phân biệt: *"Sửa cái này thì đổi **SỐ LIỆU**, đổi **CÁCH CÔNG TY VẬN HÀNH**, hay đổi **APP CÓ TÍNH NĂNG GÌ**?"*

| Key | Ý nghĩa | Tần suất sửa |
|---|---|---|
| `catalog.manage` (đã có) | Dữ liệu vận hành: sản phẩm, giá bán | Hằng tuần |
| `settings.manage` (mới) | Cấu hình doanh nghiệp: danh mục nguồn khách, thuế suất VAT | Đặt một lần rồi quên |
| `system.feature_flags` (mới) | Bật/tắt tính năng (cờ giá phân tầng FR-15) | Chỉ người vận hành app |
| `costs.view` (mới) | Xem giá vốn `Product.costPrice` + báo cáo lợi nhuận gộp | (đọc, không sửa) |

`group` của entry mới suy từ **domain prefix của key** — nhất quán 16/17 entry cũ (`orders.*`→`orders`, `audit.read`→`audit`, `dashboard.finance_view`→`dashboard`; ngoại lệ duy nhất: `permissions.manage`→`accounts`). Vậy: `settings` · `system` · `costs`.

### Đọc file bị SỬA (bắt buộc — đọc TRƯỚC khi code)

| File | Hiện trạng | Story này đổi gì | PHẢI giữ nguyên |
|---|---|---|---|
| `permission-registry.ts` (121 dòng) | `PERM` (17 key) + `PERMISSIONS` (17 entry, có label/group) + `PERMISSION_KEYS` + `isPermissionKey()` | Append 3 key vào `PERM` + 3 entry cuối `PERMISSIONS` | Thứ tự + literal 17 key cũ; `PERMISSION_KEYS`/`isPermissionKey()` (derive tự động, không sửa); 4 key ✱ FE-stub |
| `role-presets.ts` (91 dòng) | `ADMIN_PRESET` (15 key) + `ROLE_PRESETS` 7 preset; `SUPER_ADMIN` = spread + `auditRead` | +2 key vào `ADMIN_PRESET`; +1 key vào literal `SUPER_ADMIN`; +2 vào `QUAN_LY`; +1 vào `KE_TOAN`; sửa comment:13 | Bất biến `audit.read` chỉ ở `SUPER_ADMIN`; `permissions.manage` chỉ `ADMIN`+`SUPER_ADMIN`; `THO_KS`/`THI_CONG`/`KHO_GIAO` không đổi; quy ước `view_own` cho role không có `view_all` |
| `permission-registry.spec.ts` (72 dòng) | 7 test; **`toBe(17)` ở dòng 70** | 17→20 + assert 3 literal mới + assert thứ tự append | 6 test còn lại (unique, pattern snake_case, label/group không rỗng, 4 key FE-stub, view_all≠view_own) |
| `role-presets.spec.ts` (57 dòng) | 6 test; khuôn 3 test `audit.read` (dòng 17–34) | +5 test mới (AC-3 + costs.view + settings.manage) | 6 test cũ **nguyên vẹn** — chúng là bất biến `audit.read`/`permissions.manage` |
| `openapi/permissions.json` (17 entry) | Artifact generated | Regen → 20 entry | Không sửa tay; 17 entry đầu byte-identical |

### Tái dùng (scout-before-code — DRY)

- **KHÔNG viết mới** `PERMISSION_KEYS`, `isPermissionKey()`, `buildPermissionsArtifact()`, `serializePermissionsArtifact()` — tất cả **derive tự động** từ `PERMISSIONS`. Thêm entry vào `PERMISSIONS` là đủ; mọi thứ hạ nguồn tự cập nhật.
- **KHÔNG viết script gen mới** — đã có `backend/scripts/generate-permissions.ts` + `npm run permissions:gen`.
- **KHÔNG sửa `prisma/seed.ts`** — `seed.ts:45` đã đọc `[...new Set(ROLE_PRESETS.SUPER_ADMIN)]`, tự nhận 3 key mới.
- **Khuôn test có sẵn** — copy nguyên dạng ba test `audit.read` (`role-presets.spec.ts:17-34`), đổi `PERM.auditRead` → `PERM.systemFeatureFlags`. Đừng phát minh khuôn mới.

### Chiến lược test (hermetic — mirror 2.4/2.5)

Toàn bộ story này là **hằng số code + artifact file** → 100% hermetic, **không cần Postgres**, không mock Prisma. Chạy: `cd backend && npm test`.

Bốn suite liên quan trực tiếp: `permission-registry.spec.ts` · `role-presets.spec.ts` · `permissions-drift.spec.ts` · `no-permission-literal-outside-registry.spec.ts`. Chạy hẹp trước: `npm test -- permission-registry role-presets permissions-drift`, rồi mới `npm test` toàn bộ 31 suite.

### Previous Story Intelligence (2.8 vừa done + mạch 2.4–2.7)

- **2.4** dựng chính `permission-registry.ts` + `role-presets.ts` + 3 test đang sửa ở đây. Bất biến đã chốt ở 2.4: registry là nguồn literal DUY NHẤT; `orders.view_all`/`orders.view_own` là **hai** entry tường minh; `audit.read` chỉ ở `SUPER_ADMIN`. **Giữ trọn.**
- **2.4 retro learning:** 4 key ✱ trong registry giữ **nguyên văn** literal FE stub Story 1.10 để Story 2.6 chỉ đổi *nguồn* (stub → artifact), không đổi *chuỗi*. Ba key mới **chưa có** consumer FE → không đụng FE stub ở story này.
- **2.8 learning:** khi thêm thứ vào contract, **luôn regen artifact + kiểm drift-guard** trước khi báo done (2.8 regen `openapi.json`, ghi rõ "permissions.json KHÔNG đổi"). Story này thì ngược lại: `permissions.json` **ĐỔI**, `openapi.json` **KHÔNG** đổi (không route/DTO mới).
- **Action item Epic 2 (đang mở):** "Quyết TD-1 / rate-limit / integration test DB" — **không** thuộc story này, đừng ôm.

### Git Intelligence (5 commit gần nhất)

`a669eca` (1.12, chip) · `757efce` + `1d98217` (docs: 4 yêu cầu mới KH → PRD/epics/kiến trúc — **nguồn sinh ra story 2.9/2.10**) · `c84ef77` (project-context: cảnh báo thiếu integration test DB) · `183012a` (fix review Epic 2: auth hardening).

Pattern commit: `feat(story-2.9): ...` — conventional, **không** tham chiếu AI. Baseline: `a669eca`.

### Latest Tech Notes (version ghim từ project-context)

Node 24 LTS · NestJS 11.1.27 · Prisma 7.8.0 · TypeScript strict. **Không thêm dependency nào** cho story này (thuần hằng số + type). `as const` trên `PERM` giữ literal narrow để suy `PermissionKey` — thêm key mới **tự động** mở rộng union type, không cần khai type thủ công.

### Project Structure Notes — Alignment & Variances

- Đường dẫn khớp `accounts/domain` (module NestJS theo domain — CONVENTIONS.md). Không tạo file mới, không tạo thư mục mới.
- Naming key `domain.action` snake_case ✓ — cả 3 key mới khớp regex guard `/^[a-z]+(_[a-z]+)*\.[a-z]+(_[a-z]+)*$/` (`system.feature_flags` → domain `system`, action `feature_flags`).
- Định danh `PERM.*` camelCase ✓ — `settingsManage`, `systemFeatureFlags`, `costsView`.
- **Variance:** không có. Story bám đúng cấu trúc 2.4 đã dựng.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.9] — 4 AC gốc (dòng 343–349)
- [Source: _bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md#5. Quyền — 3 key mới (17 → 20)] — bảng key/nhãn/gate/preset + ranh giới ba quyền + bất biến có test
- [Source: _bmad-output/planning-artifacts/prds/.../prd.md#FR-37] — `costs.view` gate `Product.costPrice` + báo cáo lợi nhuận; response thiếu quyền **không chứa** `costPrice`
- [Source: _bmad-output/planning-artifacts/prds/.../prd.md#FR-35] — màn cấu hình danh mục gate `settings.manage`
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md:130] — `system.feature_flags` gate bấm cờ; cờ nghiệp vụ ở DB, KHÔNG Remote Config (AD-14)
- [Source: ARCHITECTURE-SPINE.md:190] — **AD-21 đường đỏ `settings.manage`**
- [Source: docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md:144-159, :184] — bản ghi quyết định 3 quyền mới + phạm vi Story 2.9
- [Source: _bmad-output/project-context.md] — bất biến AD, testing, gotchas
- [Source: backend/CONVENTIONS.md] — Permission registry naming

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Debug Log References

Không có sự cố. Trình tự chạy:

1. Baseline trước khi sửa: `npm test -- permission-registry role-presets permissions-drift` → 4 suite / 22 test xanh.
2. Sau Task 1–4: `npm test -- permission-registry role-presets permissions-drift no-permission-literal` → 5 suite / 32 test xanh.
3. Sau Task 5 (regen artifact): `git diff --stat openapi/permissions.json` → `15 insertions(+), 0 deletions` → xác nhận 17 entry cũ byte-identical, 3 entry mới thuần append ở cuối.
4. Task 6: `npm test` → **31 suite / 212 test xanh, 0 regression**. `npm run lint`, `npm run format:check`, `npm run build` sạch.
5. **Review (2026-07-13):** Task 6 chỉ chạy suite `backend` → BỎ SÓT drift-guard `design-system` (đỏ vì FE key chưa regen — xem CRITICAL C1). Sau khi sửa: backend **213** test, design-system **193**, mobile **132** + analyze sạch.

Gotcha #1 (test hardcode `17`) xảy ra đúng như dự đoán và đã xử lý ở Task 3 (đổi số + đổi tên test, không xoá test).

### Completion Notes List

- **AC-1 ✅** — 3 key append **cuối** `PERM` và **cuối** `PERMISSIONS` đúng thứ tự `settings.manage` → `system.feature_flags` → `costs.view`. 17 entry cũ giữ nguyên; test mới assert `PERMISSION_KEYS.slice(-3)` + `[0]`/`[16]` chốt thứ tự (chống reorder làm vỡ artifact deterministic — AD-17, AD-12).
- **AC-2 ✅ (có sửa đổi theo quyết định Đại Ca)** — `settings.manage` + `costs.view` vào `ADMIN_PRESET` (→ `ADMIN` + `SUPER_ADMIN` thừa hưởng); `costs.view` thêm vào `KE_TOAN` và `QUAN_LY`; `system.feature_flags` append thẳng vào literal `SUPER_ADMIN`, **không** vào `ADMIN_PRESET` (bẫy spread — Gotcha #2). **Khác AC gốc:** `settings.manage` **KHÔNG** vào `QUAN_LY` — Đại Ca chốt theo PRD §5 khi giải Open Question #1. Comment sai ở `role-presets.ts:13` đã thay bằng "`SUPER_ADMIN` = người vận hành app, ngoài tổ chức khách"; câu bất biến nay nêu **cả hai** key chỉ-SUPER_ADMIN.
- **AC-3 ✅** — 3 test mới cho `system.feature_flags` mirror đúng khuôn `audit.read`: (1) không preset nào ngoài `SUPER_ADMIN` chứa nó, (2) đúng MỘT preset chứa nó, (3) `ADMIN` tường minh không có nó. Thêm 3 test tập preset cho `costs.view`, `settings.manage`, và test THO_KS/THI_CONG/KHO_GIAO không thấy giá vốn.
- **AC-4 ✅** — `openapi/permissions.json` sinh lại qua `npm run permissions:gen` (không sửa tay — AD-12), 20 entry đúng thứ tự registry, drift-guard byte-for-byte xanh.
- **Không đụng ngoài phạm vi:** `prisma/seed.ts` giữ nguyên (tự nhận 3 key mới qua `ROLE_PRESETS.SUPER_ADMIN`); FE stub web/mobile giữ nguyên (3 key mới chưa có consumer FE); không guard/gate endpoint nào bằng 3 key mới (thuộc Story 2.10 / 3.x / 8.x); không thêm dependency.

### File List

**Code (backend):**

1. `backend/src/accounts/domain/permission-registry.ts` (UPDATE) — +3 key `PERM`, +3 entry `PERMISSIONS`, cập nhật docstring 17 → 20.
2. `backend/src/accounts/domain/role-presets.ts` (UPDATE) — `ADMIN_PRESET` +`settingsManage` +`costsView`; `SUPER_ADMIN` +`systemFeatureFlags`; `QUAN_LY` +`costsView`; `KE_TOAN` +`costsView`; sửa comment sai + comment cột preset.
3. `backend/test/permission-registry.spec.ts` (UPDATE) — `toBe(17)` → `toBe(20)`; +4 test (literal byte-for-byte, thứ tự append + khoá trọn 17 key cũ, label/group 3 entry mới, group suy từ domain prefix).
4. `backend/test/role-presets.spec.ts` (UPDATE) — +6 test theo Task 4, +2 test bất biến spread/ADMIN, +1 test **bảng vàng ma trận quyền** (thêm ở review — xem Senior Developer Review).
5. `backend/test/permissions-drift.spec.ts` (UPDATE — **ngoài 5 file dự kiến ban đầu**) — +1 test soi CHÍNH file artifact đã commit (20 entry, 3 key mới ở cuối), không chỉ bản regen in-memory.
6. `backend/openapi/permissions.json` (**GENERATED** qua `npm run permissions:gen`) — 17 → 20 entry.

**FE key sinh tự động (BẮT BUỘC regen — phát hiện ở review, xem CONVENTIONS.md:66):**

7. `web/src/design-system/gating/permission-keys.generated.ts` (**GENERATED** qua `cd design-system && npm run build:permissions`) — +3 key.
8. `mobile/lib/design_system/gating/app_permission_keys.g.dart` (**GENERATED**, cùng lệnh trên) — +3 key.
9. `design-system/permissions/build-permission-keys.mjs` (UPDATE) — sửa comment hợp đồng ghi sai "17 keys" (story này làm nó sai); bỏ con số để không stale lần sau.

**Tài liệu (đồng bộ theo quyết định Đại Ca — ngoài file code):**

10. `_bmad-output/planning-artifacts/epics.md` (UPDATE) — AC-2 Story 2.9: `settings.manage` chỉ `ADMIN`, bỏ `QUAN_LY` cho khớp PRD §5.
11. `_bmad-output/implementation-artifacts/2-9-ba-quyen-moi-settings-manage-feature-flags-costs-view.md` (UPDATE) — story file này.
12. `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE) — trạng thái story 2-9.
13. `_bmad-output/implementation-artifacts/tests/test-summary-story-2-9.md` (NEW) — tóm tắt test.

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-13 | **Quyết định Đại Ca — giải Open Question #1:** `settings.manage` **CHỈ** vào preset `ADMIN` (+ `SUPER_ADMIN` thừa hưởng), **KHÔNG** vào `QUAN_LY`. Chọn theo PRD §5 + bản ghi quyết định, **khác** epics AC-2 gốc (vốn ghi có `QUAN_LY`). Lý do nghiệp vụ: cấu hình doanh nghiệp (thuế VAT, danh mục nguồn khách) là việc của chủ, không phải quản lý vận hành. Đã đồng bộ `epics.md` AC-2 + AC-2/Task 2/Task 4 của story file cho khớp, tránh lệch tài liệu lần sau. |
| 2026-07-13 | Thêm 3 quyền `settings.manage` / `system.feature_flags` / `costs.view` vào registry chính tắc (17 → 20 key), append cuối để giữ thứ tự artifact deterministic (AD-17, AD-12). |
| 2026-07-13 | Cập nhật `role-presets.ts` theo ma trận mới; bất biến `system.feature_flags` chỉ-`SUPER_ADMIN` được test khoá (mirror khuôn `audit.read`). |
| 2026-07-13 | Sinh lại `openapi/permissions.json` (20 entry) qua `npm run permissions:gen`; drift-guard byte-for-byte xanh. |
| 2026-07-13 | **Review:** phát hiện + sửa 1 lỗi CRITICAL (FE key sinh tự động chưa regen → drift-guard `design-system` ĐỎ). Thêm bảng vàng ma trận quyền vào `role-presets.spec.ts`. Kết quả cuối: backend 31 suite / **213 test**, design-system **193/193**, mobile **132/132** + `flutter analyze` sạch. |

## Senior Developer Review (AI)

**Ngày:** 2026-07-13 · **Kết quả:** Approve (sau khi sửa hết CRITICAL)

Đã chạy `/ck:code-review` với hai reviewer đối kháng độc lập (ma trận quyền + chất lượng test/mutation testing).

### 🔴 CRITICAL (đã sửa)

**C1 — FE key sinh tự động KHÔNG được regen → drift-guard `design-system` ĐỎ.**
Story đổi `openapi/permissions.json`, nhưng Story 2.6 đã dựng một generator hạ nguồn (`design-system/permissions/build-permission-keys.mjs`) derive key FE **từ chính artifact đó** ra `web/…/permission-keys.generated.ts` + `mobile/…/app_permission_keys.g.dart`, có drift-guard so **byte-for-byte** (CONVENTIONS.md:66). Task 6 chỉ chạy `cd backend && npm test` nên **không thấy** — suite `design-system` khi đó **192/193, 1 FAIL**. Hai file FE còn kẹt ở 17 key.
*Hệ quả nếu bỏ qua:* repo ở trạng thái test đỏ; Epic 3 gate `costPrice` ở FE sẽ không có key để dùng.
*Sửa:* chạy `cd design-system && npm run build:permissions` (KHÔNG sửa tay — AD-12). Regen idempotent, thuần append 3 key ở cuối, giữ đúng thứ tự registry. → **193/193 xanh.**

### 🟠 HIGH (đã sửa)

**H1 — `role-presets.spec.ts` chỉ khoá các key được NÊU TÊN; 15 key còn lại thả nổi.**
Mutation testing chứng minh: thêm `dashboard.finance_view` + `discounts.approve` vào `THI_CONG` (leo thang quyền tài chính cho role thợ) → **cả suite vẫn XANH 36/36**. Suite tự nhận bảo vệ "ma trận FR-18 §4.6" nhưng thực tế chỉ bảo vệ 5 key được gọi tên. Chính story này thêm `costs.view` với lý do "giá vốn là dữ liệu nhạy cảm" — trong khi `dashboard.finance_view` (cũng là tài chính) thì tự do rơi vào `THI_CONG`.
*Sửa:* thêm test **bảng vàng** `MA_TRAN_QUYEN` — bản sao viết tay, độc lập, của cả 7 preset; assert từng preset khớp CHÍNH XÁC (không thừa, không thiếu). Đã mutation-test lại: bug trên nay **ĐỎ đúng 1 test**. Đổi preset từ nay buộc phải sửa bảng → mọi thay đổi ma trận quyền là quyết định tường minh, review được.

### 🟡 MEDIUM (đã sửa)

**M1 — File List sai.** Khai "đúng 5 file" nhưng git cho thấy 6 file backend (`permissions-drift.spec.ts` bị bỏ sót), chưa kể 2 file FE generated bắt buộc phải regen. Đã cập nhật File List cho khớp thực tế.
**M2 — Debug Log ghi sai số test** (206 — số thật lúc đó là 212). Đã sửa; con số cuối cùng là 213.
**M3 — Comment hợp đồng của generator ghi "17 keys"**, story này làm nó sai. Đã bỏ con số (tránh stale lần sau).

### 🟢 Đã KIỂM CHỨNG đúng — không sửa gì

Phần code từng bị `git checkout` xoá và dựng lại: **soát kỹ, KHÔNG tái phát bẫy nào.**

| Kiểm chứng | Kết quả |
|---|---|
| `settings.manage` → CHỈ `ADMIN` (+`SUPER_ADMIN` thừa hưởng) | ✅ đúng quyết định; KHÔNG lọt `QUAN_LY`/`KE_TOAN` |
| `costs.view` → `ADMIN`/`KE_TOAN`/`QUAN_LY` (+`SUPER_ADMIN`) | ✅ đúng; KHÔNG lọt `THO_KS`/`THI_CONG`/`KHO_GIAO` |
| `system.feature_flags` → **CHỈ** `SUPER_ADMIN` | ✅ append thẳng literal `SUPER_ADMIN`, **KHÔNG** ở `ADMIN_PRESET` (bẫy spread đã tránh) |
| Registry 20 key, 3 key mới append CUỐI, 17 key cũ giữ nguyên thứ tự | ✅ diff là pure-append |
| Artifact khớp regen byte-for-byte | ✅ chạy lại `permissions:gen` → 0 churn |
| AD-17 (không literal ngoài registry) | ✅ grep sạch |
| AD-21 (không gate gì bằng `settings.manage`) | ✅ không endpoint nào gate 3 key mới — đúng phạm vi |
| `prisma/seed.ts` không cần sửa | ✅ đọc `ROLE_PRESETS.SUPER_ADMIN`, tự nhận key mới; `AccountPermission.permission` là `String` (không phải enum) nên không cần migration |
| 7 mutation nhắm vào 3 key mới | ✅ **cả 7 đều ĐỎ** — test là tripwire thật, không phải trang trí |

### 🔵 Từ chối áp dụng (nêu rõ lý do)

- **Gộp 6 assertion trùng nhau về bất biến `audit.read`/`system.feature_flags` (DRY).** Story chốt rõ "6 test cũ **nguyên vẹn** — chúng là bất biến `audit.read`/`permissions.manage`". Trùng lặp ở đây là *rẻ* và có chủ đích (bất biến bảo mật đáng được khoá nhiều lớp); gộp lại sẽ xoá test hiện có, đi ngược ràng buộc đã chốt của story. **Không sửa.**
- **Test tautology `PERMISSIONS.map(...) === PERMISSION_KEYS`** (`permission-registry.spec.ts:19-21`, không bao giờ đỏ được). Là code **có trước** story này, ngoài phạm vi. Ghi nhận, không đụng.

### ⚠️ Rủi ro hệ thống (ngoài phạm vi story — đề nghị Đại Ca quyết)

**Không có CI.** Repo **không có** `.github/workflows/`. Chuỗi drift registry → artifact → key FE chỉ được bảo vệ nếu con người nhớ chạy **cả hai** suite ở **hai package** khác nhau. Lỗi C1 ở trên chính là hệ quả trực tiếp của việc này, và **sẽ tái diễn**. Đề xuất: một job CI chạy `backend`, `design-system`, `mobile` — nên là một story riêng.

## Open Questions

1. ~~**⚠️ MÂU THUẪN TÀI LIỆU — `settings.manage` có ở preset `QUAN_LY` không?**~~ → **ĐÃ CHỐT (Đại Ca, 2026-07-13): KHÔNG.** Theo PRD §5 + bản ghi quyết định: `settings.manage` chỉ ở `ADMIN` (→ `SUPER_ADMIN` thừa hưởng qua spread). `epics.md` AC-2 đã được sửa cho khớp. Ghi chú: đường đỏ AD-21 vẫn giữ nguyên (`settings.manage` KHÔNG BAO GIỜ gate màn phân quyền 8.2 / ma trận quyền 8.4 / audit log 8.5) — thi hành ở Story 2.10 + 8.x.

2. **`audit.read` gate theo quyền, không theo role (FR-20)** — bản ghi quyết định nói "FR-20 phải sửa". Không thuộc phạm vi 2.9 (preset `audit.read` giữ nguyên); xác nhận việc này rơi vào Story 8.2/8.5. **Vẫn mở.**
