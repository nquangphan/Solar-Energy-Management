import { CONTRACT_TYPE, type ContractType } from './contract-type';

/**
 * Contract number and file name — PURE DOMAIN.
 *
 * `seq` is a global serial reserved from the `contracts.seq` sequence BEFORE rendering (the
 * number is printed inside the PDF). It never resets per year: unique and simple; a per-year
 * reset is a feature nobody asked for.
 */

const UTC7_OFFSET_MS = 7 * 60 * 60 * 1000;

const NUMBER_PREFIX: Readonly<Record<ContractType, string>> = {
  [CONTRACT_TYPE.construction]: 'HĐTC',
  [CONTRACT_TYPE.sale]: 'HĐMB',
};

/** ASCII only: a `Content-Disposition` header cannot carry `Đ`. */
const FILE_PREFIX: Readonly<Record<ContractType, string>> = {
  [CONTRACT_TYPE.construction]: 'hop-dong-thi-cong',
  [CONTRACT_TYPE.sale]: 'hop-dong-mua-ban',
};

/** `HĐTC-{seq}/{yyyy}` or `HĐMB-{seq}/{yyyy}`; the year is the issue year in UTC+7. */
export function formatContractNo(
  type: ContractType,
  seq: number,
  issuedAt: Date,
): string {
  const year = new Date(issuedAt.getTime() + UTC7_OFFSET_MS).getUTCFullYear();
  return `${NUMBER_PREFIX[type]}-${seq}/${year}`;
}

/** File name without extension — the download route appends `.pdf`. */
export function contractFileName(type: ContractType, seq: number): string {
  return `${FILE_PREFIX[type]}-${seq}`;
}

/** R2 object key — a new key per generation, never overwritten. */
export function contractPdfKey(orderId: string, contractId: string): string {
  return `contracts/${orderId}/${contractId}.pdf`;
}
