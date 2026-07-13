// hand-authored — TEST/DEMO-ONLY fake port (Story 3.5).
//
// NOT a real backend: an in-memory catalogue so the config screen is
// demoable/guardable WITHOUT an app-runtime, bundler or network.
//
// It models the SHAPE of the backend's answers, not its authority. The two rules
// it does mimic — "the isOther row cannot be switched off" and "a duplicate name
// is rejected" — are here so the demo shows the real error surface, NOT because
// this is where they are enforced. They are enforced on the server (AD-4), and the
// server would reject these calls even if every line below were deleted.

import type {
  CreateCustomerSourceInput,
  CustomerSourcePortError,
  CustomerSourceRow,
  CustomerSourcesPort,
  UpdateCustomerSourceInput,
} from './customer-sources-port';

/** Demo catalogue — the five seeded sources, one of them carrying the `isOther` flag. */
export const DEMO_CUSTOMER_SOURCE_ROWS: CustomerSourceRow[] = [
  {
    id: 'src-facebook',
    name: 'Facebook',
    description: 'Khách nhắn tin hoặc bình luận từ quảng cáo/bài đăng Facebook.',
    active: true,
    sortOrder: 1,
    isOther: false,
  },
  {
    id: 'src-zalo',
    name: 'Zalo',
    description: 'Khách liên hệ qua Zalo (tin nhắn trực tiếp hoặc Zalo OA).',
    active: true,
    sortOrder: 2,
    isOther: false,
  },
  {
    id: 'src-fanpage',
    name: 'Fanpage',
    description: 'Khách đến từ fanpage của công ty, ngoài luồng quảng cáo trả phí.',
    active: true,
    sortOrder: 3,
    isOther: false,
  },
  {
    id: 'src-daily',
    name: 'Đại lý',
    description: 'Khách do đại lý/cộng tác viên giới thiệu về.',
    active: false,
    sortOrder: 4,
    isOther: false,
  },
  {
    id: 'src-khac',
    name: 'Khác',
    description: 'Nguồn không nằm trong danh sách — bắt buộc ghi rõ ở ô ghi chú nguồn.',
    active: true,
    sortOrder: 99,
    isOther: true,
  },
];

/** An AD-5-shaped rejection, so the screen exercises its real error path in the demo. */
function reject(error: CustomerSourcePortError): Promise<never> {
  return Promise.reject(error);
}

/**
 * A `CustomerSourcesPort` backed by an in-memory list — TEST/DEMO ONLY. Pass custom
 * data to model any state (empty catalogue, everything switched off…).
 */
export class FakeCustomerSourcesPort implements CustomerSourcesPort {
  // A plain field, NOT a `private rows` constructor parameter property: that TS-only
  // shorthand cannot be type-stripped, and Node runs this file by stripping types
  // (see session/fake-customer-sources-port.test.mjs — the only executable test of any
  // web code in the repo). Keep it plain or that lane goes dark.
  private rows: CustomerSourceRow[];

  constructor(rows: CustomerSourceRow[] = [...DEMO_CUSTOMER_SOURCE_ROWS]) {
    this.rows = rows;
  }

  list(includeInactive: boolean): Promise<CustomerSourceRow[]> {
    const visible = includeInactive ? this.rows : this.rows.filter((r) => r.active);
    return Promise.resolve([...visible].sort((a, b) => a.sortOrder - b.sortOrder));
  }

  create(input: CreateCustomerSourceInput): Promise<CustomerSourceRow> {
    if (this.rows.some((r) => r.name === input.name)) {
      return reject({
        message: `Đã có nguồn khách tên: ${input.name}`,
        fieldErrors: [{ field: 'name', message: 'Tên nguồn này đã có trong danh mục.' }],
      });
    }
    const created: CustomerSourceRow = {
      id: `src-${this.rows.length + 1}`,
      name: input.name,
      description: input.description ?? null,
      active: true,
      // Omitted ⇒ appended at the end. The REAL one computes this server-side; the
      // fake copies the outcome so the demo row lands where the user expects.
      sortOrder: input.sortOrder ?? Math.max(-1, ...this.rows.map((r) => r.sortOrder)) + 1,
      // Never settable — the flag belongs to the seed (see customer-sources-port.ts).
      isOther: false,
    };
    this.rows = [...this.rows, created];
    return Promise.resolve(created);
  }

  update(id: string, patch: UpdateCustomerSourceInput): Promise<CustomerSourceRow> {
    const current = this.rows.find((r) => r.id === id);
    if (current === undefined) return reject({ message: `Không tìm thấy nguồn khách: ${id}` });
    if (patch.name !== undefined && this.rows.some((r) => r.name === patch.name && r.id !== id)) {
      return reject({
        message: `Đã có nguồn khách tên: ${patch.name}`,
        fieldErrors: [{ field: 'name', message: 'Tên nguồn này đã có trong danh mục.' }],
      });
    }
    // An absent key leaves the value alone; `description: null` clears it. The
    // `isOther` flag survives a rename untouched — that is the whole point of it.
    const updated: CustomerSourceRow = {
      ...current,
      name: patch.name ?? current.name,
      description: patch.description === undefined ? current.description : patch.description,
      sortOrder: patch.sortOrder ?? current.sortOrder,
    };
    this.rows = this.rows.map((r) => (r.id === id ? updated : r));
    return Promise.resolve(updated);
  }

  deactivate(id: string): Promise<void> {
    const current = this.rows.find((r) => r.id === id);
    if (current === undefined) return reject({ message: `Không tìm thấy nguồn khách: ${id}` });
    if (current.isOther) {
      return reject({
        message:
          'Không tắt được nguồn "Khác": mọi nguồn ngoài danh sách rơi vào đây, và luật bắt buộc ghi rõ nguồn phụ thuộc vào nó. Đổi tên thì được.',
      });
    }
    this.rows = this.rows.map((r) => (r.id === id ? { ...r, active: false } : r));
    return Promise.resolve();
  }

  reactivate(id: string): Promise<CustomerSourceRow> {
    const current = this.rows.find((r) => r.id === id);
    if (current === undefined) return reject({ message: `Không tìm thấy nguồn khách: ${id}` });
    const updated = { ...current, active: true };
    this.rows = this.rows.map((r) => (r.id === id ? updated : r));
    return Promise.resolve(updated);
  }
}
