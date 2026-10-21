import {
  LEGAL_ENTITY_FIELDS,
  missingLegalEntityFields,
  type CompanyLegalEntity,
} from '../src/settings/domain/company-legal-entity';
import {
  SETTING,
  SETTING_DEFAULTS,
} from '../src/settings/domain/setting-registry';

const EMPTY: CompanyLegalEntity = {
  legalName: '',
  taxCode: '',
  address: '',
  representative: '',
  representativeTitle: '',
  phone: '',
  bankAccount: '',
};

describe('company legal entity (settings domain)', () => {
  it('nothing configured ⇒ all 7 labels, in the fixed display order', () => {
    expect(missingLegalEntityFields(EMPTY)).toEqual([
      'Tên công ty',
      'Mã số thuế',
      'Địa chỉ',
      'Người đại diện',
      'Chức danh',
      'Điện thoại',
      'Tài khoản ngân hàng',
    ]);
  });

  it('whitespace-only counts as missing; filled fields drop out', () => {
    expect(
      missingLegalEntityFields({
        ...EMPTY,
        legalName: 'CÔNG TY A',
        taxCode: '   ',
        bankAccount: '123',
      }),
    ).toEqual([
      'Mã số thuế',
      'Địa chỉ',
      'Người đại diện',
      'Chức danh',
      'Điện thoại',
    ]);
  });

  it('every field maps to a distinct company.* setting key, seeded empty', () => {
    const keys = LEGAL_ENTITY_FIELDS.map(({ key }) => key);
    expect(new Set(keys).size).toBe(7);
    for (const key of keys) {
      expect(key.startsWith('company.')).toBe(true);
      expect(SETTING_DEFAULTS[key]).toBe('');
    }
    // The VAT setting keeps its default.
    expect(SETTING_DEFAULTS[SETTING.vatRatePercent]).toBe('8');
  });
});
