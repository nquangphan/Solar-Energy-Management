// hand-authored — web stock-vouchers port (Story 6.3, mirror Flutter
// mobile/lib/design_system/session/stock_vouchers_port.dart). The seam between
// the Phiếu kho screen and `/stock-vouchers`.
//
// A SEPARATE port from `InventoryPort` on purpose: the Tồn kho screen is read-only
// and its port carries no write verb. Vouchers are the one thing that moves
// `onHand`, so the write lives here.
//
// THE CLIENT COMPUTES NOTHING (AD-2). The voucher `code`, `lineCount`,
// `totalQty`, the weighted-average cost and the "not enough stock" decision are
// all the backend's. `unitCost` is ABSENT (not 0, not null) when the caller lacks
// `costs.view` — the screen renders a cost column only when the field is there.
//
// Every data type below is the GENERATED contract type (AD-12).

import type { components, paths } from '../../api/generated/schema';

type Schemas = components['schemas'];

/** `StockVoucherCreatorDto`. */
export type StockVoucherCreator = Schemas['StockVoucherCreatorDto'];

/**
 * `StockVoucherSummaryDto`. `code` is the display code built by the backend
 * (`PK-N-0119`). `orderId` is ABSENT (not null) on a free-standing voucher;
 * `returnOfVoucherId` is set ONLY on a return voucher (`PK-NT-…`). `totalQty` is
 * always positive — the direction comes from `type`.
 */
export type StockVoucherSummary = Schemas['StockVoucherSummaryDto'];

/** `nhap` = stock in · `xuat` = stock out (free-standing, or bound to an order via `orderId`). */
export type VoucherType = StockVoucherSummary['type'];

/** `StockVoucherLineResponseDto`. `unitCost` (đồng) is ABSENT when the caller lacks `costs.view`. */
export type StockVoucherLine = Schemas['StockVoucherLineResponseDto'];

/**
 * `StockVoucherDetailDto`. `returnOf` (return voucher only) names the origin
 * stock-out; `returnVoucher` is set on an order-bound stock-out that already has
 * one. `canReturn` is decided by the backend and ALWAYS present.
 */
export type StockVoucherDetail = Schemas['StockVoucherDetailDto'];

/** `StockVoucherListResponseDto`. */
export type StockVoucherList = Schemas['StockVoucherListResponseDto'];

/** `isReturn`: `true` = return vouchers only; `false` = everything except them. */
export type StockVoucherListQuery = NonNullable<
  paths['/stock-vouchers']['get']['parameters']['query']
>;

/** One line of `CreateStockVoucherRequestDto`: `unitCost` REQUIRED on `nhap`, OMITTED on `xuat`. */
export type CreateStockVoucherLineInput = Schemas['StockVoucherLineRequestDto'];

/** `CreateStockVoucherRequestDto`. */
export type CreateStockVoucherInput = Schemas['CreateStockVoucherRequestDto'];

/** `CreateReturnVoucherRequestDto`. Cost is never sent — the origin line's cost is reused. */
export type CreateReturnVoucherInput = Schemas['CreateReturnVoucherRequestDto'];

/**
 * The AD-5 error envelope this port rejects with (400 validation, 404 unknown
 * product, 409 not enough stock / product not stockable). `field` is the
 * backend's path, e.g. `lines.0.qty`. The screen renders `message` verbatim.
 */
export interface StockVoucherPortError {
  message: string;
  fieldErrors?: { field: string; code: string; message: string }[];
}

/**
 * Injectable transport for the Phiếu kho screen. A PORT, NOT an HTTP client.
 *
 * The real implementation is `web/src/api/http-stock-vouchers-port.ts` (the
 * transport attaches the Bearer token and parses the AD-5 envelope).
 */
export interface StockVouchersPort {
  listVouchers(query?: StockVoucherListQuery): Promise<StockVoucherList>;
  getVoucher(id: string): Promise<StockVoucherDetail>;
  /** Rejects with `StockVoucherPortError` on 400 / 404 / 409. */
  createVoucher(input: CreateStockVoucherInput): Promise<StockVoucherDetail>;
  /**
   * `POST /stock-vouchers/:originVoucherId/return`. Rejects with `StockVoucherPortError` on
   * 400 (`lines.{i}.qty|productId`, `i` = index in the SUBMITTED array) / 404 / 409.
   */
  createReturnVoucher(
    originVoucherId: string,
    input: CreateReturnVoucherInput,
  ): Promise<StockVoucherDetail>;
}
