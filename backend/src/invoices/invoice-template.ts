import { amountInWords } from '../common/money/amount-in-words';
import {
  buildFontFaces,
  escapeHtml,
  formatDateVn,
  formatMoney,
  loadAssets,
} from '../orders/quote/quote-template';

/**
 * Invoice template (FR-28) — `buildInvoiceHtml` is PURE in the sense that it is testable without a
 * browser, Nest or Prisma: it takes the invoice snapshot (amounts already `number`) and returns an
 * HTML string.
 *
 *  - Everything printed comes from the snapshot stored at issue time (Story 7.4) — never from the
 *    live order, customer or settings.
 *  - ZERO money arithmetic: line amounts and totals are the stored ones, only formatted here. The
 *    snapshot carries no cost price and no warranty, so neither can be printed.
 *  - Every string — static or dynamic — goes through `escapeHtml`.
 *  - A seller field that was empty at issue time prints "Chưa cấu hình" (never blocks).
 */

export interface InvoiceTemplateLine {
  readonly name: string;
  readonly unit: string;
  readonly qty: number;
  readonly unitPrice: number;
  /** Stored line amount — the template never multiplies. */
  readonly amount: number;
}

export interface InvoiceTemplateData {
  readonly invoiceNo: string;
  /** Issue date, printed in UTC+7. */
  readonly issuedAt: Date;
  /** Same number as the printed quote and contracts (`quoteNumberOf`). */
  readonly quoteNo: string;
  readonly versionNo: number;
  readonly seller: {
    readonly legalName: string;
    readonly taxCode: string;
    readonly address: string;
    readonly representative: string;
    readonly representativeTitle: string;
    readonly phone: string;
    readonly bankAccount: string;
  };
  readonly customer: {
    readonly name: string;
    readonly sdt: string;
    readonly taxCode: string | null;
    readonly address: string | null;
  };
  /** In `displayOrder`. */
  readonly lines: readonly InvoiceTemplateLine[];
  /** Integer percent (8 = 8%) — only for the VAT label. */
  readonly vatRate: number;
  readonly applyVat: boolean;
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly vatAmount: number;
  readonly total: number;
}

/** Printed for a seller field nobody configured when the invoice was issued. Declared here, not
 *  imported from `contracts/`: the two modules stay independent. */
export const NOT_CONFIGURED_LABEL = 'Chưa cấu hình';

export const NO_TAX_CODE_LABEL = 'Không có MST';

const t = escapeHtml;

function sellerValue(value: string): string {
  return value.trim() !== '' ? t(value) : t(NOT_CONFIGURED_LABEL);
}

function field(label: string, valueHtml: string): string {
  return `<div class="field"><span class="field-label">${t(label)}:</span> ${valueHtml}</div>`;
}

function linesTable(data: InvoiceTemplateData): string {
  const rows = data.lines
    .map(
      (line, index) => `<tr>
        <td class="c">${index + 1}</td>
        <td>${t(line.name)}</td>
        <td class="c">${t(line.unit)}</td>
        <td class="r">${formatMoney(line.qty)}</td>
        <td class="r">${formatMoney(line.unitPrice)}</td>
        <td class="r">${formatMoney(line.amount)}</td>
      </tr>`,
    )
    .join('\n');
  const row = (label: string, value: string, cls = 'total-row') =>
    `<tr class="${cls}"><td colspan="5" class="r">${t(label)}</td><td class="r">${value}</td></tr>`;
  const vatLabel = data.applyVat ? `VAT (${data.vatRate}%)` : 'VAT (không áp)';
  const totals = [
    row('Tổng trước VAT', formatMoney(data.subtotal)),
    data.discountAmount > 0
      ? row('Chiết khấu', `-${formatMoney(data.discountAmount)}`)
      : '',
    row(vatLabel, formatMoney(data.vatAmount)),
    row('Tổng thanh toán', formatMoney(data.total), 'total-row grand'),
  ]
    .filter((html) => html !== '')
    .join('\n');
  return `<table class="lines">
    <thead>
      <tr>
        <th>${t('STT')}</th>
        <th>${t('Tên hàng')}</th>
        <th>${t('ĐVT')}</th>
        <th>${t('Số lượng')}</th>
        <th>${t('Đơn giá')}</th>
        <th>${t('Thành tiền')}</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      ${totals}
    </tbody>
  </table>`;
}

export function buildInvoiceHtml(data: InvoiceTemplateData): string {
  const assets = loadAssets();
  const s = data.seller;
  const logoHtml = assets.logoBase64
    ? `<img class="logo" src="data:image/png;base64,${assets.logoBase64}" alt="" />`
    : '';
  const customerAddress =
    data.customer.address !== null && data.customer.address.trim() !== ''
      ? field('Địa chỉ', t(data.customer.address))
      : '';
  const customerTaxCode =
    data.customer.taxCode !== null && data.customer.taxCode.trim() !== ''
      ? t(data.customer.taxCode)
      : t(NO_TAX_CODE_LABEL);
  const representative =
    s.representative.trim() !== ''
      ? `<div class="sign-name">${t(s.representative)}</div>${
          s.representativeTitle.trim() !== ''
            ? `<div class="sign-note">${t(s.representativeTitle)}</div>`
            : ''
        }`
      : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<style>
${buildFontFaces(assets)}
@page { size: A4; margin: 18mm 16mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Be Vietnam Pro', 'Helvetica Neue', Arial, sans-serif;
  font-size: 11.5px;
  line-height: 1.45;
  color: #111;
  background: #fff;
}
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.seller { display: flex; gap: 12px; align-items: flex-start; }
.logo { width: 84px; height: auto; }
.seller-name { font-weight: 600; font-size: 13px; }
.invoice-no { border: 1px solid #111; padding: 4px 10px; font-weight: 600; white-space: nowrap; }
h1.title { text-align: center; font-size: 17px; font-weight: 600; margin: 16px 0 2px; }
.meta { text-align: center; margin-bottom: 10px; }
.customer-block { border: 1px solid #111; padding: 6px 8px; }
.field-label { font-weight: 600; }
table.lines { width: 100%; border-collapse: collapse; margin-top: 10px; page-break-inside: auto; }
table.lines th, table.lines td { border: 1px solid #111; padding: 3px 6px; vertical-align: top; }
table.lines th { font-weight: 600; text-align: center; }
tr { page-break-inside: avoid; }
td.c { text-align: center; }
td.r { text-align: right; }
tr.total-row td { font-weight: 600; }
tr.grand td { font-size: 12.5px; }
.in-words { margin-top: 6px; font-style: italic; }
.sign-block { display: flex; margin-top: 24px; text-align: center; page-break-inside: avoid; }
.sign-col { flex: 1; }
.sign-title { font-weight: 600; }
.sign-space { height: 72px; }
.sign-name { font-weight: 600; }
.footer-note { margin-top: 26px; font-size: 9.5px; text-align: center; }
</style>
</head>
<body>
  <div class="head">
    <div class="seller">
      ${logoHtml}
      <div>
        <div class="seller-name">${sellerValue(s.legalName)}</div>
        ${field('MST', sellerValue(s.taxCode))}
        ${field('Địa chỉ', sellerValue(s.address))}
        ${field('Điện thoại', sellerValue(s.phone))}
        ${field('Tài khoản ngân hàng', sellerValue(s.bankAccount))}
      </div>
    </div>
    <div class="invoice-no">${t('Số HĐ')} ${t(data.invoiceNo)}</div>
  </div>

  <h1 class="title">${t('HOÁ ĐƠN BÁN HÀNG')}</h1>
  <div class="meta">${t('Ngày lập')}: ${formatDateVn(data.issuedAt)} · ${t('Gắn đơn')}: ${t(data.quoteNo)} (${t('bản')} ${data.versionNo})</div>

  <div class="customer-block">
    ${field('Khách hàng', t(data.customer.name))}
    ${field('MST', customerTaxCode)}
    ${customerAddress}
    ${field('Điện thoại', t(data.customer.sdt))}
  </div>

  ${linesTable(data)}
  <div class="in-words">${t('Số tiền viết bằng chữ')}: ${t(amountInWords(data.total))}</div>

  <div class="sign-block">
    <div class="sign-col">
      <div class="sign-title">${t('NGƯỜI LẬP PHIẾU')}</div>
      <div class="sign-space"></div>
    </div>
    <div class="sign-col">
      <div class="sign-title">${t('GIÁM ĐỐC')}</div>
      <div class="sign-space"></div>
      ${representative}
    </div>
  </div>

  <div class="footer-note">${t('Hoá đơn nội bộ — không phải hoá đơn điện tử.')}</div>
</body>
</html>`;
}
