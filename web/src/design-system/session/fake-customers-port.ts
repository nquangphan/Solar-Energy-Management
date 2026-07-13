// hand-authored — TEST/DEMO-ONLY fake port (Story 3.4, mirror Flutter
// mobile/lib/design_system/session/fake_customers_port.dart).
//
// NOT a real backend: an in-memory list so the three customer screens are
// demoable/guardable WITHOUT an app-runtime, bundler or network. It enforces NO
// business rule — the real ones (phone normalisation, duplicate blocking, the
// `isOther` ⇒ `sourceNote` rule, permissions) all live on the server (AD-4/AD-9).
//
// The lookup here matches on the digits of the stored key so the demo behaves
// like the real endpoint for a raw-typed number. That is a DEMO CONVENIENCE, not
// a normaliser: it never produces a key, it only compares.

import type {
  CreateCustomerInput,
  Customer,
  CustomerListQuery,
  CustomerLookup,
  CustomerPage,
  CustomerSource,
  CustomersPort,
} from './customers-port';

const NOW = '2026-07-13T00:00:00.000Z';

/** Demo catalogue — one source carries `isOther`, which is what reveals `Ghi rõ nguồn`. */
export const DEMO_CUSTOMER_SOURCES: CustomerSource[] = [
  { id: 'src-facebook', name: 'Facebook', description: 'Từ quảng cáo Facebook.', isOther: false, sortOrder: 1 },
  { id: 'src-zalo', name: 'Zalo', description: null, isOther: false, sortOrder: 2 },
  { id: 'src-khac', name: 'Khác', description: null, isOther: true, sortOrder: 99 },
];

/** Demo customers — at least one of each type, one of them on the `isOther` source. */
export const DEMO_CUSTOMERS: Customer[] = [
  {
    sdt: '+84903176968',
    custType: 'CA_NHAN',
    name: 'Nguyễn Văn A',
    cccd: '079201001234',
    taxCode: null,
    address: '12 Nguyễn Huệ, Quận 1, TP.HCM',
    bankAccount: null,
    sourceId: 'src-facebook',
    sourceNote: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    sdt: '+84912345678',
    custType: 'THUONG_MAI',
    name: 'Công ty TNHH Hoà Phát',
    cccd: null,
    taxCode: '0312345678',
    address: '45 Lê Lợi, Quận 1, TP.HCM',
    bankAccount: '0071000123456 - Vietcombank',
    sourceId: 'src-khac',
    sourceNote: 'Khách cũ giới thiệu',
    createdAt: NOW,
    updatedAt: NOW,
  },
];

/** Digits of a string, minus any leading zeros — mirrors what the BACKEND does when searching. */
function digits(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+/, '');
}

/**
 * A `CustomersPort` backed by an in-memory list — TEST/DEMO ONLY. Pass custom
 * data to model any state (empty catalogue, a customer on an `isOther` source…).
 */
export class FakeCustomersPort implements CustomersPort {
  constructor(
    private customers: Customer[] = [...DEMO_CUSTOMERS],
    private readonly sources: CustomerSource[] = DEMO_CUSTOMER_SOURCES,
  ) {}

  lookup(sdt: string): Promise<CustomerLookup> {
    const needle = digits(sdt);
    const found = this.customers.find((c) => digits(c.sdt).endsWith(needle) && needle !== '');
    return Promise.resolve({
      found: found !== undefined,
      sdt: found?.sdt ?? sdt,
      customer: found ?? null,
    });
  }

  list(query: CustomerListQuery): Promise<CustomerPage> {
    const q = query.q?.trim() ?? '';
    const needle = digits(q);
    const matched = this.customers.filter((c) => {
      if (query.custType != null && query.custType !== '' && c.custType !== query.custType) return false;
      if (q === '') return true;
      const byName = c.name.toLowerCase().includes(q.toLowerCase());
      const bySdt = needle !== '' && c.sdt.includes(needle);
      return byName || bySdt;
    });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    return Promise.resolve({
      items: matched.slice((page - 1) * pageSize, page * pageSize),
      total: matched.length,
      page,
      pageSize,
    });
  }

  get(sdt: string): Promise<Customer> {
    const needle = digits(sdt);
    const found = this.customers.find((c) => digits(c.sdt).endsWith(needle));
    return found === undefined
      ? Promise.reject(new Error(`Không tìm thấy khách hàng: ${sdt}`))
      : Promise.resolve(found);
  }

  create(input: CreateCustomerInput): Promise<Customer> {
    const created: Customer = {
      sdt: input.sdt,
      custType: input.custType,
      name: input.name,
      cccd: input.cccd ?? null,
      taxCode: input.taxCode ?? null,
      address: input.address ?? null,
      bankAccount: input.bankAccount ?? null,
      sourceId: input.sourceId,
      sourceNote: input.sourceNote ?? null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    this.customers = [created, ...this.customers];
    return Promise.resolve(created);
  }

  listSources(): Promise<CustomerSource[]> {
    return Promise.resolve(this.sources);
  }
}
