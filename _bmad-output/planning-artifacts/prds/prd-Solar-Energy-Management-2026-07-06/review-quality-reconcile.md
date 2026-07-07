# PRD Quality + Reconciliation Review — Phương Nam Solar (Phase 1)

Reviewed: `prd.md` (2026-07-06) against `prd-validation-checklist.md`, `brief.md`, `addendum.md`, `phase-1-feature-list.md`.
Scope: rubric compliance + internal consistency after heavy editing + reconciliation vs source inputs. No files edited.

## Overall verdict — PASS-WITH-FIXES

This is a strong internal-tool PRD: a specific non-generic Vision, a solid Glossary, every FR carries testable Consequences, Non-Goals do real work, and the Assumptions Index round-trips cleanly. The mechanics the task worried about are actually clean — FR-1..FR-28 are contiguous with no gaps, no duplicates, and **no FR-23a exists** (the task brief's expectation is stale). "Offline", "HĐĐT provider integration", and "hoá đơn điện tử" appear only as explicit, consistent Non-Goals — no dangling positive references, and "phát hành HĐĐT" does not appear at all.

What's at risk is a genuine data-model hole (customer entity is used everywhere but never defined or given CRUD), one net-new permission decision (Super Admin as sole audit-log viewer) that is unsourced and un-integrated into the permission matrix and in tension with the transparency thesis, and two addendum "put this in the PRD" items that didn't land (delivery timeline; a couple of real-template output details). None are catastrophic, but the customer-entity gap will bite UX/Architecture/story creation immediately.

---

## Decision-readiness — adequate

Decisions read as decisions, not considerations. The unified quote-order model, per-account permissions, snapshot-on-close, and hybrid scope-flags are stated firmly and match the addendum's "Quyết định kiến trúc chốt". Trade-offs are mostly carried in the addendum (options A/B considered-and-rejected) rather than the PRD, which is acceptable given §0 positions the addendum as the depth doc.

One soft spot: §8 opens with "Các quyết định nghiệp vụ đã chốt" while the entire permission matrix (§4.6) and the state-name list (§4.2) are tagged `[ASSUMPTION]`. Those are business decisions, not just "chi tiết kỹ thuật". The framing slightly oversells how settled things are.

### Findings
- **low** Open-Questions framing vs assumption load (§8) — "business decisions all closed" undercut by the fully-`[ASSUMPTION]` permission matrix and unconfirmed state names. *Fix:* reword §8 intro to acknowledge the matrix and state-name list are proposed-pending-confirmation, or promote them to Open Questions.

## Substance over theater — strong

No persona theater (5 JTBD entries + explicit Non-Users, each tied to a real capability). No innovation/NFR/vision theater — the Vision names the concrete pain (2-day quote → minutes) and the "máy tăng tốc, không ai phải chờ ai" thesis is carried consistently from brief. NFR section has product-specific bounds (idempotent financial ops, immutable audit, solo-dev simplicity constraint) rather than boilerplate. UJs each have a named protagonist (Hùng, Lan, Tú) carrying context inline.

## Strategic coherence — strong

Clear thesis (speed + accuracy, dual co-equal goals), and the feature set serves it. MVP scope kind is a coherent internal operations platform. Success Metrics validate the thesis (speed SM-2, accuracy SM-3, adoption SM-4) and a counter-metric (SM-C1) guards against gaming speed by skipping audit/approval. Good.

### Findings
- **low** SM-1 validation range excludes late FRs (§7) — "SM-1 … Validates FR-1..FR-22", but reliability (the #1 acceptance criterion) should also cover inventory (FR-25/26), invoicing (FR-27/28), and attachments (FR-23/24). *Fix:* change to FR-1..FR-28.

## Done-ness clarity — adequate

Every FR has at least one testable Consequence; most are genuinely verifiable (realtime totals, snapshot immutability, gate-by-flag, block-on-insufficient-stock). This is the PRD's strongest downstream asset. SM-1's "chạy trơn tru… không lỗi" is unmeasurable but is honestly flagged `[ASSUMPTION: chốt ngưỡng]`.

### Findings
- **medium** Customer data has no acceptance surface — FR-1 says "chọn Khách hàng", FR-27 pulls "khách hàng (MST)", FR-13 fills "hai bên", but no FR defines creating a customer or its fields. Nothing tells an engineer what "done" means for customer capture. *Fix:* add an FR for customer management (see Reconciliation R1).
- **low** Audit-log viewing has a hard rule but no permission-model home — FR-20 states "Chỉ một account Super Admin được xem Audit log", yet no matrix row and no glossary/role integration make that testable against the per-account model. *Fix:* see R2.

## Scope honesty — strong

Non-Goals (§5) and Out-of-MVP (§6.2) are explicit and mutually consistent: no external accounts, no discount auto-limit, not full CRM, not full accounting, no e-invoice provider, single warehouse, no offline. `[ASSUMPTION]` tags are applied to inferences and indexed. Open-items density is reasonable for a green-light-to-build internal tool; the two Open Questions are real (image limits/storage; final state names + deposit→status mapping) and correctly deferred to Architecture.

## Downstream usability — adequate (this PRD is chain-top: feeds UX → Architecture → Epics/Stories)

Glossary present and mostly disciplined; FR/UJ/SM IDs contiguous and unique; cross-refs (§4.2, §4.6, FR-5, FR-8) resolve. The gaps below matter more here than they would for a standalone PRD because source-extraction is the point.

### Findings
- **high** "Khách hàng" used as a first-class, bolded term but never defined and never given CRUD (Glossary §3 line 61 bolds it as if defined; FR-1/FR-13/FR-27 depend on it). The addendum specifies distinct shapes — cá nhân (CCCD) vs công ty (MST + tài khoản NH) — none of which appear as fields anywhere. Architecture cannot model the customer entity from this PRD. *Fix:* add a Glossary entry for Khách hàng and an FR for customer CRUD carrying the CCCD vs MST+bank-account distinction from the addendum.
- **medium** "Hợp đồng" undefined in Glossary though central (§4.4, FR-13, matrix row "Sinh hợp đồng"), while the sibling term "Hoá đơn" *is* defined. Contract vs Invoice is a load-bearing distinction (two different documents, different triggers). *Fix:* add a Glossary entry for Hợp đồng, cross-referencing HĐ Thi công / HĐ Mua bán.
- **low** Versioning term drift — FR-6 mixes "bản update mới" / "Version mới" / "lịch sử các bản update" for one concept the sources call "BẢN VERSION mới". Not in Glossary. *Fix:* pick one term (e.g. "Bản update") and add a Glossary entry.
- **low** Undefined domain nouns/acronyms used without gloss: "Đợt thanh toán" (defined only inline inside Lịch thanh toán), "Duyệt" (capitalized like a term, only inline-defined), "PO", "MST", "BG…" (quote number). Minor; downstream can infer, but a one-line each would harden extraction.

## Shape fit — strong

Correctly shaped as an internal multi-role tool: capability-spec body with FR groups, plus three load-bearing UJs (field quoting, event-driven status, permission provisioning) that genuinely drive design — appropriate since this is multi-stakeholder B2B with meaningful field UX, not a single-operator tool. Not over-formalized, not under-formalized. SMs are appropriately operational.

---

## Reconciliation vs source inputs

Decisions found in brief/addendum/feature-list, checked for presence/contradiction in the PRD.

- **R1 — high — Customer entity dropped.** Addendum "Đối chiếu mẫu thật" fixes customer shape: cá nhân = CCCD; công ty = MST + tài khoản NH. Brief/feature-list treat "chọn khách hàng" as a step. PRD has no customer FR, no Glossary entry, no fields. *Contradiction type: decided-in-source, missing-in-PRD.* See also Done-ness / Downstream findings.
- **R2 — medium/high — "Super Admin sole audit-log viewer" is net-new and unsourced.** Not in brief, addendum, or feature-list. Feature-list §8 wants "Audit log mọi hành động … làm bằng chứng" with no viewer restriction, and both brief and brainstorm stress transparency ("phân quyền không để giấu thông tin", "nội bộ đã minh bạch"). Introducing a single all-powerful Super Admin who alone reads the audit log (a) invents a 7th role outside the sourced 6-role set, (b) is absent from the §4.6 permission matrix, and (c) sits in tension with the stated transparency thesis. *Fix:* either source/justify this decision explicitly and add it to the permission model as a configurable "Xem audit log" permission, or relax it to match the transparency principle. Flag for PM — this is a business decision, not a mechanical fix.
- **R3 — medium — Phase 1 delivery timeline missing.** Addendum "Cần chốt thêm (đưa vào PRD)" explicitly lists "Timeline giao Phase 1 và quy mô đội phát triển". Team size landed (NFR: "solo dev"); timeline did not appear anywhere in the PRD. *Fix:* add timeline to NFR/scope, or move to Open Questions if still unknown.
- **R4 — low/medium — Real-template output details not reflected.** Addendum's template reconciliation lists a footer signature block ("Người lập phiếu" + "Giám đốc ký/đóng dấu") and distributor logo on quotes/contracts. FR-13 (contract) and FR-21 (quote export) don't mention the signature block or logo. *Fix:* add to FR-13/FR-21 consequences or note as an Architecture/template detail.
- **R5 — low — "Khảo sát" state step dropped.** Addendum and feature-list both call out "bước Khảo sát chỉ xuất hiện khi bật cờ Thi công". The §4.2 proposed chain jumps to "Lên lịch thi công → Đang thi công → Nghiệm thu" with no Khảo sát step. Mitigated because state names are flagged `[ASSUMPTION]` / Open Q #2. *Fix:* confirm whether Khảo sát is a distinct state when resolving Open Q #2.
- **R6 — low — Addendum "chốt thêm" items partially deferred.** Full state list (with actor/condition per step) and full permission set + presets were requested to be finalized in the PRD; the PRD provides both but flags them entirely `[ASSUMPTION]`/proposed. Acceptable deferral to Architecture, but note the addendum wanted them settled.

Positive reconciliation checks that passed: unified quote-order object, hybrid scope-flags + Loại khách preset, event-driven status auto-transition, per-account permissions with role presets, snapshot-on-close + no retro, tiered pricing behind a default-off flag, multi-installment payment schedule, two contract types referencing BG number, VAT 8% three-line total, kWp + validity fields, GÓI/free-line + "Diễn giải" + "linh động" flag, native share of image/PDF — all present and consistent with sources. Inventory (FR-25/26) and invoice (FR-27/28) are correctly scoped as additions over the brief's 9 groups and are internally consistent.

---

## Mechanical notes

- **FR ID continuity:** FR-1..FR-28 contiguous, unique, no gaps, no duplicates. **No FR-23a exists** — the task premise is stale; numbering is clean.
- **Removed-content references:** "offline", "HĐĐT/hoá đơn điện tử provider" appear only as consistent Non-Goals (§4.9 FR-22, §4.12, §5, §6.2). "phát hành HĐĐT" does not appear. No dangling positive references.
- **Assumptions Index round-trip:** clean. All 13 index entries in §9 map to an inline `[ASSUMPTION]` (FR-1, FR-2, FR-3, FR-4, §4.2, FR-8, FR-11, FR-13, FR-15, FR-17, §4.6 matrix, FR-19, FR-24) and vice versa. FR-2 carries two inline tags collapsed to one index entry — fine.
- **Glossary drift:** minor — "bản update"/"Version" (FR-6); "Đợt thanh toán"/"Duyệt" defined only inline; undefined "Khách hàng" and "Hợp đồng" (see Downstream findings). No case/plural/synonym drift on the core nouns (Đơn, Chốt, Cờ phạm vi, Snapshot giá, Account/Role/Quyền) — those are used identically throughout.
- **Matrix rows vs features:** matrix covers the main action permissions but omits rows implied by FRs: audit-log viewing (FR-20), image attach/edit (FR-23/24 references an undefined "quyền chỉnh sửa đơn hàng"), payment-schedule config (FR-11), VAT-rate config (FR-3), quote export/share (FR-21). Acceptable since the matrix is flagged proposed/`[ASSUMPTION]`, except the FR-20 audit gap (R2) which is stated as a hard rule.
- **Self-reference nit:** §0 says tech decisions live in addendum "không nằm trong PRD", yet §4.9 and NFR state ReactJS/Flutter/NodeJS/VPS/shared design system. Low; likely intentional context, but it contradicts §0.

## Suggested fix priority
1. R1 — add Customer glossary entry + CRUD FR with CCCD vs MST+bank fields (high; unblocks data model).
2. R2 — resolve Super Admin / audit-log-view: source it + add to permission model, or relax to match transparency thesis (PM decision).
3. Add "Hợp đồng" to Glossary (medium).
4. R3 — add Phase 1 timeline or move to Open Questions (medium).
5. R4/R5, SM-1 range, versioning-term unification, §0 self-reference (low polish).
