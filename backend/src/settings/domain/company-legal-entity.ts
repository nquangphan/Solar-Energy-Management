import { SETTING, type SettingKey } from './setting-registry';

/**
 * Company legal entity printed as the company party of a contract (7.3, F-4) — PURE DOMAIN.
 *
 * Read from `system_settings`, seeded empty: every field may be `''` (not configured). A missing
 * field never blocks a contract; it prints "Chưa cấu hình".
 */
export interface CompanyLegalEntity {
  readonly legalName: string;
  readonly taxCode: string;
  readonly address: string;
  readonly representative: string;
  readonly representativeTitle: string;
  readonly phone: string;
  readonly bankAccount: string;
}

export type CompanyLegalEntityField = keyof CompanyLegalEntity;

/**
 * Field ↔ setting key ↔ Vietnamese label, in the FIXED display order (the order of
 * `missingLegalEntityFields` and of the settings form).
 */
export const LEGAL_ENTITY_FIELDS: ReadonlyArray<{
  readonly field: CompanyLegalEntityField;
  readonly key: SettingKey;
  readonly label: string;
}> = [
  { field: 'legalName', key: SETTING.companyLegalName, label: 'Tên công ty' },
  { field: 'taxCode', key: SETTING.companyTaxCode, label: 'Mã số thuế' },
  { field: 'address', key: SETTING.companyAddress, label: 'Địa chỉ' },
  {
    field: 'representative',
    key: SETTING.companyRepresentative,
    label: 'Người đại diện',
  },
  {
    field: 'representativeTitle',
    key: SETTING.companyRepresentativeTitle,
    label: 'Chức danh',
  },
  { field: 'phone', key: SETTING.companyPhone, label: 'Điện thoại' },
  {
    field: 'bankAccount',
    key: SETTING.companyBankAccount,
    label: 'Tài khoản ngân hàng',
  },
];

/** Labels of the fields that are empty after trim, in display order. */
export function missingLegalEntityFields(entity: CompanyLegalEntity): string[] {
  return LEGAL_ENTITY_FIELDS.filter(
    ({ field }) => entity[field].trim() === '',
  ).map(({ label }) => label);
}
