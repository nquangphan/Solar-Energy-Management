/**
 * Hai LOẠI khách (FR-29) — registry `as const` (cùng khuôn `PERM` của
 * `accounts/domain/permission-registry.ts`), KHÔNG Postgres enum: thêm loại khách sau này
 * không phải chạy migration enum, và cột `custType` lưu String + validate ở tầng app.
 *
 * Mỗi loại có BỘ TRƯỜNG riêng, và field không thuộc loại đang chọn mà xuất hiện trong body
 * ⇒ 400 (fail-closed). Nuốt im lặng một `taxCode` gửi kèm khách Cá nhân là để dành một quả
 * mìn cho Hoá đơn (FR-27) — nơi MST thật sự được dùng.
 */
export const CUST_TYPE = {
  caNhan: 'CA_NHAN',
  thuongMai: 'THUONG_MAI',
} as const;

/** Kiểu union của mọi loại khách hợp lệ (`'CA_NHAN' | 'THUONG_MAI'`). */
export type CustType = (typeof CUST_TYPE)[keyof typeof CUST_TYPE];

/** Danh sách phẳng để `@IsIn(...)` ở DTO và để test lặp qua từng loại. */
export const CUST_TYPES: readonly CustType[] = Object.values(CUST_TYPE);

/**
 * Field KHÔNG được phép gửi kèm cho từng loại khách. `name`/`address`/`sdt`/`sourceId`/
 * `sourceNote` dùng chung cả hai loại nên không nằm ở đây.
 */
export const FORBIDDEN_FIELDS: Readonly<Record<CustType, readonly string[]>> = {
  // Cá nhân không có Mã số thuế, không có tài khoản ngân hàng công ty.
  [CUST_TYPE.caNhan]: ['taxCode', 'bankAccount'],
  // Công ty không có CCCD.
  [CUST_TYPE.thuongMai]: ['cccd'],
};
