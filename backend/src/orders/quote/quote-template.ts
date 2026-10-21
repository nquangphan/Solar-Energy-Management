import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import type { OrderTotals } from '../domain/order-totals';
import { COMPANY_INFO } from './company-info';

/**
 * Template báo giá — MỘT nguồn layout cho CẢ PDF lẫn ảnh (FR-21).
 *
 * `buildQuoteHtml` là hàm THUẦN theo nghĩa test được không cần browser/Nest/Prisma:
 * nhận `QuoteTemplateData` đã tính sẵn, trả HTML string. Template ZERO số học tiền
 * (AD-16): thành tiền dòng = `amount` server đã tính, totals = output `computeOrderTotals`
 * — ở đây CHỈ format (dấu chấm ngàn kiểu `76.862.000`). Input KHÔNG có giá vốn dưới
 * bất kỳ dạng nào.
 *
 * Font Be Vietnam Pro (OFL) bundle ở `backend/assets/fonts/` embed base64 qua
 * `@font-face` — render giống nhau trên mac dev lẫn VPS Linux; thiếu file font →
 * fallback font-stack hệ thống (không vỡ render). Logo: đọc `backend/assets/quote/logo.png`
 * NẾU tồn tại; không có → hiện tên công ty dạng chữ.
 */

export interface QuoteTemplateLine {
  readonly name: string;
  readonly unit: string;
  readonly qty: number;
  readonly unitPrice: number;
  /** Thành tiền server đã tính (`OrderLineView.amount`) — template không nhân lại. */
  readonly amount: number;
  readonly warrantyMonths: number | null;
}

export interface QuoteTemplateData {
  /** Số báo giá dạng `BG-XXXXXXXX` (8 ký tự đầu orderId, upper). */
  readonly quoteNo: string;
  /** Ngày xuất (hiển thị dd/MM/yyyy theo UTC+7). */
  readonly exportedAt: Date;
  readonly validityNote: string | null;
  readonly kWp: number | null;
  readonly scopeThietBi: boolean;
  readonly scopeThiCong: boolean;
  readonly scopeVanChuyen: boolean;
  readonly customer: {
    readonly name: string;
    readonly sdt: string;
    readonly address: string | null;
    readonly taxCode: string | null;
  };
  readonly lines: readonly QuoteTemplateLine[];
  /** Output `computeOrderTotals` — MỘT hàm pricing (AD-16). */
  readonly totals: OrderTotals;
  /** Phần trăm nguyên (8 = 8%) — chỉ để hiển thị nhãn VAT. */
  readonly vatRate: number;
  readonly applyVat: boolean;
}

/** Escape mọi dữ liệu động trước khi nhúng HTML — tên khách chứa `<b>` không thành tag. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format số kiểu VN dấu chấm ngàn: 76862000 → `76.862.000` (regex thuần, không locale). */
export function formatMoney(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Cột Bảo hành: chia hết 12 → "X năm", khác → "X tháng", null → rỗng (quyết định khách L200). */
export function formatWarranty(months: number | null): string {
  if (months === null) return '';
  if (months % 12 === 0) return `${months / 12} năm`;
  return `${months} tháng`;
}

/** dd/MM/yyyy theo UTC+7 (client hiển thị giờ VN — mirror quy ước hiển thị chung). */
export function formatDateVn(date: Date): string {
  const utc7 = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const dd = String(utc7.getUTCDate()).padStart(2, '0');
  const mm = String(utc7.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${utc7.getUTCFullYear()}`;
}

/** Ô tick phạm vi: ☑ khi cờ bật, ☐ khi tắt. */
function scopeTick(checked: boolean, label: string): string {
  return `<span class="scope-tick">${checked ? '&#9745;' : '&#9744;'} ${label}</span>`;
}

// ---------------------------------------------------------------------------
// Assets (font/logo) — đọc MỘT lần, cache module-level. Đường dẫn thử cả layout
// chạy từ src (ts-jest) lẫn dist (nest build): cả hai đều là <backend>/assets.
// ---------------------------------------------------------------------------

function resolveAssetsDir(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../../assets'),
    path.resolve(__dirname, '../../../../assets'),
    path.resolve(process.cwd(), 'assets'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return null;
}

export interface QuoteAssets {
  readonly fontRegularBase64: string | null;
  readonly fontSemiBoldBase64: string | null;
  readonly logoBase64: string | null;
}

let cachedAssets: QuoteAssets | null = null;

export function loadAssets(): QuoteAssets {
  if (cachedAssets) return cachedAssets;
  const dir = resolveAssetsDir();
  const readBase64 = (relPath: string): string | null => {
    if (!dir) return null;
    const filePath = path.join(dir, relPath);
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath).toString('base64');
  };
  cachedAssets = {
    fontRegularBase64: readBase64('fonts/BeVietnamPro-Regular.ttf'),
    fontSemiBoldBase64: readBase64('fonts/BeVietnamPro-SemiBold.ttf'),
    logoBase64: readBase64('quote/logo.png'),
  };
  return cachedAssets;
}

export function buildFontFaces(assets: QuoteAssets): string {
  const faces: string[] = [];
  if (assets.fontRegularBase64) {
    faces.push(`@font-face {
      font-family: 'Be Vietnam Pro';
      font-weight: 400;
      src: url(data:font/ttf;base64,${assets.fontRegularBase64}) format('truetype');
    }`);
  }
  if (assets.fontSemiBoldBase64) {
    faces.push(`@font-face {
      font-family: 'Be Vietnam Pro';
      font-weight: 600;
      src: url(data:font/ttf;base64,${assets.fontSemiBoldBase64}) format('truetype');
    }`);
  }
  return faces.join('\n');
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export function buildQuoteHtml(data: QuoteTemplateData): string {
  const assets = loadAssets();
  const c = COMPANY_INFO;

  const logoHtml = assets.logoBase64
    ? `<img class="logo" src="data:image/png;base64,${assets.logoBase64}" alt="" />`
    : '';

  const rows = data.lines
    .map(
      (line, index) => `<tr>
        <td class="c">${index + 1}</td>
        <td>${escapeHtml(line.name)}</td>
        <td class="c">${escapeHtml(line.unit)}</td>
        <td class="r">${formatMoney(line.qty)}</td>
        <td class="r">${formatMoney(line.unitPrice)}</td>
        <td class="r">${formatMoney(line.amount)}</td>
        <td class="c">${formatWarranty(line.warrantyMonths)}</td>
      </tr>`,
    )
    .join('\n');

  const discountRow =
    data.totals.discountAmount > 0
      ? `<tr class="total-row">
          <td colspan="5" class="r">Chiết khấu</td>
          <td class="r">-${formatMoney(data.totals.discountAmount)}</td>
          <td></td>
        </tr>`
      : '';

  const vatLabel = data.applyVat ? `VAT (${data.vatRate}%)` : 'VAT';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<style>
${buildFontFaces(assets)}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Be Vietnam Pro', 'Helvetica Neue', Arial, sans-serif;
  font-size: 11px;
  color: #111;
  width: 794px;
  padding: 28px 32px;
  background: #fff;
}
.company-header { display: flex; gap: 12px; align-items: flex-start; }
.logo { width: 84px; height: auto; }
.company-name { font-weight: 600; font-size: 13px; }
.company-line { font-size: 10px; margin-top: 2px; }
h1.title { text-align: center; font-size: 17px; font-weight: 600; margin: 16px 0 4px; }
.meta-row { display: flex; justify-content: space-between; margin-top: 2px; font-size: 11px; }
.scope-row { margin-top: 6px; }
.scope-tick { margin-right: 18px; }
.customer-block { margin-top: 8px; border: 1px solid #111; padding: 6px 8px; }
table.lines { width: 100%; border-collapse: collapse; margin-top: 10px; }
table.lines th, table.lines td { border: 1px solid #111; padding: 4px 6px; vertical-align: top; }
table.lines th { font-weight: 600; text-align: center; background: #fff; }
td.c { text-align: center; }
td.r { text-align: right; }
tr.total-row td { font-weight: 600; }
.terms { margin-top: 10px; }
.bank { margin-top: 6px; }
.sign-block { display: flex; margin-top: 24px; text-align: center; }
.sign-col { flex: 1; }
.sign-title { font-weight: 600; }
.sign-note { font-size: 10px; }
.sign-space { height: 64px; }
.footer-note { margin-top: 26px; font-size: 9px; font-weight: 600; text-align: center; }
</style>
</head>
<body>
  <div class="company-header">
    ${logoHtml}
    <div>
      <div class="company-name">${c.name}</div>
      <div class="company-line">${c.taxCode}</div>
      ${c.addresses.map((address) => `<div class="company-line">${address}</div>`).join('\n      ')}
    </div>
  </div>

  <h1 class="title">${c.quoteTitle}</h1>

  <div class="meta-row">
    <span>Số: ${escapeHtml(data.quoteNo)}</span>
    <span>Ngày: ${formatDateVn(data.exportedAt)}</span>
    <span>Loại tiền: ${c.currencyLabel}</span>
  </div>
  <div class="meta-row">
    <span>Hiệu lực đến: ${data.validityNote ? escapeHtml(data.validityNote) : ''}</span>
    <span>Công suất: ${data.kWp !== null ? escapeHtml(String(data.kWp)) : ''} kWp</span>
  </div>
  <div class="scope-row">
    ${scopeTick(data.scopeThietBi, 'Cung cấp thiết bị')}
    ${scopeTick(data.scopeThiCong, 'Cung cấp thi công')}
    ${scopeTick(data.scopeVanChuyen, 'Cung cấp vận chuyển')}
  </div>

  <div class="customer-block">
    <div>Tên khách hàng: ${escapeHtml(data.customer.name)}</div>
    <div>Điện thoại: ${escapeHtml(data.customer.sdt)}</div>
    <div>Địa chỉ: ${data.customer.address ? escapeHtml(data.customer.address) : ''}</div>
    <div>Mã số thuế: ${data.customer.taxCode ? escapeHtml(data.customer.taxCode) : ''}</div>
  </div>

  <table class="lines">
    <thead>
      <tr>
        <th>STT</th>
        <th>Tên hàng</th>
        <th>Đơn vị tính</th>
        <th>Số lượng</th>
        <th>Đơn giá</th>
        <th>Thành tiền</th>
        <th>Bảo hành</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="5" class="r">TỔNG CỘNG</td>
        <td class="r">${formatMoney(data.totals.subtotal)}</td>
        <td></td>
      </tr>
      ${discountRow}
      <tr class="total-row">
        <td colspan="5" class="r">${vatLabel}</td>
        <td class="r">${formatMoney(data.totals.vatAmount)}</td>
        <td></td>
      </tr>
      <tr class="total-row">
        <td colspan="5" class="r">Tổng sau VAT</td>
        <td class="r">${formatMoney(data.totals.total)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <div class="terms">${c.paymentTerms}</div>
  <div class="bank">
    <div>${c.bankHeading}</div>
    <div>${c.bankLine}</div>
  </div>

  <div class="sign-block">
    <div class="sign-col">
      <div class="sign-title">${c.signLeftTitle}</div>
      <div class="sign-note">${c.signLeftNote}</div>
      <div class="sign-space"></div>
    </div>
    <div class="sign-col">
      <div class="sign-title">${c.signRightTitle}</div>
      <div class="sign-note">${c.signRightNote}</div>
      <div class="sign-space"></div>
    </div>
  </div>

  <div class="footer-note">${c.footer}</div>
</body>
</html>`;
}
