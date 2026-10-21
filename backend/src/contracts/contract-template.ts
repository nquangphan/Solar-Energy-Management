import type { OrderTotals } from '../orders/domain/order-totals';
import {
  buildFontFaces,
  escapeHtml,
  formatDateVn,
  formatMoney,
  formatWarranty,
  loadAssets,
  type QuoteTemplateLine,
} from '../orders/quote/quote-template';
import type { CompanyLegalEntity } from '../settings/domain/company-legal-entity';
import { CONSTRUCTION_CLAUSES } from './clauses/construction-clauses';
import { SALE_CLAUSES } from './clauses/sale-clauses';
import { amountInWords } from '../common/money/amount-in-words';
import {
  CONTRACT_TYPE,
  NOT_CONFIGURED_LABEL,
  type ContractType,
} from './domain/contract-type';

/**
 * Contract template (FR-13) — `buildContractHtml` is PURE in the sense that it is testable without
 * a browser, Nest or Prisma: it takes pre-computed data and returns an HTML string.
 *
 *  - Clauses are static text from `clauses/` (verbatim from the two company templates); only the
 *    parties, line table, totals, installments, quote reference and warranty list are filled in.
 *  - ZERO money arithmetic: line amounts are the server's `amount`, totals are the output of
 *    `resolveOrderTotals`, installment amounts are the stored ones. Here they are only formatted.
 *    The input carries no cost price in any form.
 *  - Every filled-in piece is wrapped in `<!--d-->…<!--/d-->`. Cutting those regions out leaves
 *    the static part, which must be byte-identical for any two orders of the same type.
 *  - Every string — static or dynamic — goes through `escapeHtml`.
 *  - A company field nobody configured prints "Chưa cấu hình" (never blocks, F-4); a customer
 *    field the customer record lacks prints a dotted line to fill in by hand at signing.
 */

export interface ContractTemplateInstallment {
  readonly seq: number;
  /** What the user typed; `null` when the installment was entered as an amount. */
  readonly percent: number | null;
  /** Integer dong stored on the installment. */
  readonly amount: number;
  readonly conditionNote: string;
}

export interface ContractTemplateData {
  readonly type: ContractType;
  readonly contractNo: string;
  /** Issue date, printed in UTC+7. */
  readonly issuedAt: Date;
  /** Same number as the printed quote (`quoteNumberOf`). */
  readonly quoteNo: string;
  readonly kWp: number | null;
  readonly customer: {
    readonly name: string;
    readonly sdt: string;
    readonly address: string | null;
    readonly cccd: string | null;
    readonly taxCode: string | null;
    readonly bankAccount: string | null;
  };
  readonly company: CompanyLegalEntity;
  readonly lines: readonly QuoteTemplateLine[];
  /** Output of `resolveOrderTotals` — ONE pricing function (AD-16). */
  readonly totals: OrderTotals;
  /** Integer percent (8 = 8%) — only for the VAT label. */
  readonly vatRate: number;
  readonly applyVat: boolean;
  readonly installments: readonly ContractTemplateInstallment[];
}

/** Dotted fill-in line for customer data the system does not have. */
export const FILL_IN_LINE = '……………………';

/** Marks a filled-in region (see the file doc). */
function dyn(html: string): string {
  return `<!--d-->${html}<!--/d-->`;
}

/** Escaped static text. */
const t = escapeHtml;

function customerValue(value: string | null): string {
  return dyn(value !== null && value.trim() !== '' ? t(value) : FILL_IN_LINE);
}

function companyValue(value: string): string {
  return dyn(value.trim() !== '' ? t(value) : NOT_CONFIGURED_LABEL);
}

function paragraphs(lines: readonly string[]): string {
  return lines.map((line) => `<p>${t(line)}</p>`).join('\n');
}

function heading(text: string): string {
  return `<h2>${t(text)}</h2>`;
}

function field(label: string, valueHtml: string): string {
  return `<p class="field"><span class="field-label">${t(label)}</span>: ${valueHtml}</p>`;
}

/** "Hôm nay, ngày dd tháng MM năm yyyy" in UTC+7. */
function todayClause(issuedAt: Date): string {
  const [dd, mm, yyyy] = formatDateVn(issuedAt).split('/');
  return `Hôm nay, ngày ${dyn(dd)} tháng ${dyn(mm)} năm ${dyn(yyyy)}`;
}

function linesTable(data: ContractTemplateData, withTotals: boolean): string {
  const rows = data.lines
    .map(
      (line, index) => `<tr>
        <td class="c">${index + 1}</td>
        <td>${t(line.name)}</td>
        <td class="c">${t(line.unit)}</td>
        <td class="r">${formatMoney(line.qty)}</td>
        <td class="r">${formatMoney(line.unitPrice)}</td>
        <td class="r">${formatMoney(line.amount)}</td>
        <td class="c">${formatWarranty(line.warrantyMonths)}</td>
      </tr>`,
    )
    .join('\n');
  return `<table class="lines">
    <thead>
      <tr>
        <th>STT</th>
        <th>Tên hàng</th>
        <th>ĐVT</th>
        <th>Số lượng</th>
        <th>Đơn giá</th>
        <th>Thành tiền</th>
        <th>Bảo hành</th>
      </tr>
    </thead>
    <tbody>
      ${dyn(rows)}
      ${withTotals ? dyn(totalRows(data, 7)) : ''}
    </tbody>
  </table>`;
}

/** Tổng cộng / Chiết khấu (only when > 0) / VAT / Tổng sau VAT rows. */
function totalRows(data: ContractTemplateData, columns: 7 | 2): string {
  const span = columns === 7 ? 5 : 1;
  const tail = columns === 7 ? '<td></td>' : '';
  const row = (label: string, value: string) =>
    `<tr class="total-row"><td colspan="${span}" class="r">${t(label)}</td><td class="r">${value}</td>${tail}</tr>`;
  const vatLabel = data.applyVat ? `VAT (${data.vatRate}%)` : 'VAT';
  return [
    row('Tổng cộng', formatMoney(data.totals.subtotal)),
    data.totals.discountAmount > 0
      ? row('Chiết khấu', `-${formatMoney(data.totals.discountAmount)}`)
      : '',
    row(vatLabel, formatMoney(data.totals.vatAmount)),
    row('Tổng sau VAT', formatMoney(data.totals.total)),
  ]
    .filter((html) => html !== '')
    .join('\n');
}

function installmentLines(data: ContractTemplateData): string {
  return data.installments
    .map((installment) => {
      const money = `${formatMoney(installment.amount)} đồng (${t(amountInWords(installment.amount))})`;
      const body =
        installment.percent !== null
          ? `${installment.percent}% giá trị hợp đồng với số tiền là: ${money}`
          : `Thanh toán số tiền ${money}`;
      const note =
        installment.conditionNote.trim() !== ''
          ? ` — ${t(installment.conditionNote)}`
          : '';
      return `<p>+ Đợt ${installment.seq}: ${body}${note}.</p>`;
    })
    .join('\n');
}

function warrantyLines(
  data: ContractTemplateData,
  render: (name: string, warranty: string) => string,
): string {
  return data.lines
    .filter((line) => line.warrantyMonths !== null)
    .map(
      (line) =>
        `<p>${render(t(line.name), t(formatWarranty(line.warrantyMonths)))}</p>`,
    )
    .join('\n');
}

function signBlock(
  labels: { readonly signA: string; readonly signB: string },
  data: ContractTemplateData,
): string {
  return `<div class="sign-block">
    <div class="sign-col">
      <div class="sign-title">${t(labels.signA)}</div>
      <div class="sign-space"></div>
      <div class="sign-name">${customerValue(data.customer.name)}</div>
    </div>
    <div class="sign-col">
      <div class="sign-title">${t(labels.signB)}</div>
      <div class="sign-space"></div>
      <div class="sign-name">${companyValue(data.company.representative)}</div>
    </div>
  </div>`;
}

function header(
  clauses: {
    readonly motto: readonly string[];
    readonly mottoRule: string;
    readonly title: string;
    readonly legalBases: readonly string[];
  },
  contractNo: string,
): string {
  return `<div class="motto">
    ${clauses.motto.map((line) => `<div class="motto-line">${t(line)}</div>`).join('\n')}
    <div class="motto-rule">${t(clauses.mottoRule)}</div>
  </div>
  <h1 class="title">${t(clauses.title)}</h1>
  <div class="contract-no">Số: ${dyn(t(contractNo))}</div>
  <div class="bases">${paragraphs(clauses.legalBases)}</div>`;
}

function constructionBody(data: ContractTemplateData): string {
  const c = CONSTRUCTION_CLAUSES;
  // `kWp` null ⇒ no capacity phrase at all (never "null kWp").
  const capacity = dyn(
    data.kWp !== null ? `, công suất ${t(String(data.kWp))} kWp` : '',
  );
  return `${header(c, data.contractNo)}
  <p>${todayClause(data.issuedAt)}, chúng tôi gồm các bên dưới đây:</p>

  <p class="party">${t(c.partyALabel)} ${dyn(t(data.customer.name))}</p>
  ${field('Địa chỉ', customerValue(data.customer.address))}
  ${field('Điện thoại', customerValue(data.customer.sdt))}
  ${field('Số CCCD', customerValue(data.customer.cccd))}
  ${field('Mã số thuế', customerValue(data.customer.taxCode))}

  <p class="party">${t(c.partyBLabel)} ${companyValue(data.company.legalName)}</p>
  ${field('Đại diện', companyValue(data.company.representative))}
  ${field('Chức vụ', companyValue(data.company.representativeTitle))}
  ${field('Địa chỉ', companyValue(data.company.address))}
  ${field('Điện thoại', companyValue(data.company.phone))}
  ${field('Mã số thuế', companyValue(data.company.taxCode))}
  ${field('Tài khoản số', companyValue(data.company.bankAccount))}

  <p>${t(c.agreement)}</p>
  ${heading(c.article1Heading)}
  <p>${t(c.article1Intro)} ${customerValue(data.customer.address)}${capacity}.</p>
  <p>${t(c.article1Materials)}</p>
  ${linesTable(data, false)}
  <p>(Chi tiết báo giá số: ${dyn(t(data.quoteNo))} kèm theo)</p>

  ${heading(c.article2Heading)}
  <p>${t(c.article2Value)}</p>
  <table class="totals"><tbody>${dyn(totalRows(data, 2))}</tbody></table>
  <p>(Bằng chữ: ${dyn(t(amountInWords(data.totals.total)))})</p>
  ${paragraphs(c.article2Progress)}

  ${heading(c.article3Heading)}
  <p>${t(c.article3Method)}</p>
  ${dyn(installmentLines(data))}
  <p>${t(c.article3DossierHeading)}</p>
  <ul>${c.article3Dossier.map((item) => `<li>${t(item)}</li>`).join('')}</ul>
  <p>${t(c.article3Review)}</p>
  <p>${t(c.article3Info)}</p>
  <p>- STK ${companyValue(data.company.bankAccount)}</p>

  ${heading(c.article4Heading)}
  ${paragraphs(c.article4)}

  ${heading(c.article5Heading)}
  ${paragraphs(c.article5PartyA)}
  ${paragraphs(c.article5PartyBBeforeGoods)}
  ${dyn(warrantyLines(data, (name, warranty) => `+ ${name}, Bảo hành ${warranty}.`))}
  ${paragraphs(c.article5PartyBAfterGoods)}

  ${heading(c.article6Heading)}
  ${paragraphs(c.article6)}
  ${heading(c.article7Heading)}
  ${paragraphs(c.article7)}
  ${heading(c.article8Heading)}
  ${paragraphs(c.article8)}

  ${signBlock(c, data)}`;
}

function saleBody(data: ContractTemplateData): string {
  const c = SALE_CLAUSES;
  const totalSentence = data.applyVat
    ? 'Tổng giá trị hợp đồng bao gồm thuế GTGT'
    : 'Tổng giá trị hợp đồng';
  return `${header(c, data.contractNo)}
  <p>${todayClause(data.issuedAt)}, tại TP. Hồ Chí Minh, chúng tôi gồm các bên dưới đây:</p>

  <p class="party">${t(c.partyALabel)} ${dyn(t(data.customer.name))}</p>
  ${field('Địa chỉ', customerValue(data.customer.address))}
  ${field('Điện thoại', customerValue(data.customer.sdt))}
  ${field('Mã Số Thuế', customerValue(data.customer.taxCode))}
  ${field('Tài khoản số', customerValue(data.customer.bankAccount))}
  ${field('Đại diện', customerValue(null))}
  ${field('Chức Vụ', customerValue(null))}

  <p class="party">${t(c.partyBLabel)} ${companyValue(data.company.legalName)}</p>
  ${field('Địa chỉ', companyValue(data.company.address))}
  ${field('Điện thoại', companyValue(data.company.phone))}
  ${field('Mã Số Thuế', companyValue(data.company.taxCode))}
  ${field('Tài khoản số', companyValue(data.company.bankAccount))}
  ${field('Đại diện', companyValue(data.company.representative))}
  ${field('Chức Vụ', companyValue(data.company.representativeTitle))}

  <p>${t(c.agreement)}</p>
  ${heading(c.article1Heading)}
  <p>${t(c.article1Value)}</p>
  ${linesTable(data, true)}
  <p>${dyn(t(totalSentence))}: ${dyn(formatMoney(data.totals.total))} VNĐ (Bằng chữ: ${dyn(t(amountInWords(data.totals.total)))})</p>
  <p>(Chi tiết báo giá số: ${dyn(t(data.quoteNo))} kèm theo)</p>
  <p>${t(c.article1Method)}</p>
  <p>${t(c.article1Transfer)}</p>
  ${dyn(installmentLines(data))}

  ${heading(c.article2Heading)}
  ${paragraphs(c.article2)}
  <ul>${c.article2Documents.map((item) => `<li>${t(item)}</li>`).join('')}</ul>
  ${heading(c.article3Heading)}
  ${paragraphs(c.article3)}

  ${heading(c.article4Heading)}
  <p>${t(c.article4Intro)}</p>
  ${paragraphs(c.article4BeforeProducts)}
  ${dyn(warrantyLines(data, (name, warranty) => `- ${name}, bảo hành ${warranty}.`))}
  ${paragraphs(c.article4AfterProducts)}

  ${heading(c.article5Heading)}
  ${paragraphs(c.article5)}
  ${heading(c.article6Heading)}
  ${paragraphs(c.article6)}
  ${heading(c.article7Heading)}
  ${paragraphs(c.article7)}
  ${heading(c.article8Heading)}
  ${paragraphs(c.article8)}

  ${signBlock(c, data)}`;
}

export function buildContractHtml(data: ContractTemplateData): string {
  const body =
    data.type === CONTRACT_TYPE.construction
      ? constructionBody(data)
      : saleBody(data);
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<style>
${buildFontFaces(loadAssets())}
@page { size: A4; margin: 18mm 16mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Be Vietnam Pro', 'Helvetica Neue', Arial, sans-serif;
  font-size: 11.5px;
  line-height: 1.45;
  color: #111;
  background: #fff;
}
.motto { text-align: center; font-weight: 600; }
.motto-rule { margin-top: 2px; }
h1.title { text-align: center; font-size: 17px; font-weight: 600; margin: 14px 0 2px; }
.contract-no { text-align: center; margin-bottom: 10px; }
.bases p { font-style: italic; }
p { margin-top: 3px; text-align: justify; }
p.party { font-weight: 600; margin-top: 8px; }
.field-label { display: inline-block; min-width: 92px; }
h2 { font-size: 12px; font-weight: 600; margin-top: 10px; page-break-after: avoid; }
ul { margin: 2px 0 2px 22px; }
table.lines, table.totals { border-collapse: collapse; margin-top: 6px; page-break-inside: auto; }
table.lines { width: 100%; }
table.lines th, table.lines td, table.totals td { border: 1px solid #111; padding: 3px 6px; vertical-align: top; }
table.lines th { font-weight: 600; text-align: center; }
tr { page-break-inside: avoid; }
td.c { text-align: center; }
td.r { text-align: right; }
tr.total-row td { font-weight: 600; }
.sign-block { display: flex; margin-top: 24px; text-align: center; page-break-inside: avoid; }
.sign-col { flex: 1; }
.sign-title { font-weight: 600; }
.sign-space { height: 84px; }
.sign-name { font-weight: 600; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}
