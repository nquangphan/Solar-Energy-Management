// Web follows the contract (Story 10.5); mobile keeps the old names until Story 10.8.
// Delete this file in 10.8 — every entry must still be live (asserted by
// web-mobile-contract-map.test.mjs, against the mobile class that owns it); the guards that
// compare a name on both platforms look it up — the web side checks the contract name, the
// mobile side the mapped one.
//
// One-way and keyed by contract DTO: `name` is `ten` on a stock line but `name` on an
// order line, so a flat field table would map the wrong twin.

/** Web (contract) port method → the mobile twin's method. */
export const WEB_TO_MOBILE_METHOD = {
  transition: 'chuyenTrangThai',
  cancel: 'huyDon',
  listAttachments: 'listAnh',
  addAttachments: 'themAnh',
  removeAttachment: 'xoaAnh',
  attachmentBytes: 'anhBytes',
};

/** Contract DTO → { contract field → mobile field } for every field mobile still names differently. */
export const WEB_TO_MOBILE_FIELD = {
  OrderResponseDto: {
    customerPhone: 'customerSdt',
    scopeEquipment: 'scopeThietBi',
    scopeConstruction: 'scopeThiCong',
    scopeDelivery: 'scopeVanChuyen',
  },
  OrderListItemDto: { customerPhone: 'customerSdt' },
  DiscountPendingItemDto: { customerPhone: 'customerSdt' },
  InvoiceDetailResponseDto: { customerPhone: 'customerSdt' },
  OrderLifecycleStepDto: { progress: 'trangThai' },
  OrderLifecycleResponseDto: { steps: 'buoc', nextSteps: 'buocKeTiep', canCancel: 'coTheHuy' },
  StatusChangeResponseDto: { savedAttachmentCount: 'soAnhDaLuu' },
  AttachmentItemDto: { uploadedBy: 'nguoiTaiLen', canDelete: 'coTheXoa' },
  OrderVersionItemDto: {
    isCurrent: 'laBanHienLuc',
    confirmedAt: 'chotAt',
    lineCount: 'soDong',
    changes: 'thayDoi',
  },
  VersionChangesDto: { added: 'them', removed: 'xoa', qtyChanged: 'doiSoLuong' },
  QtyChangeDto: { name: 'ten', from: 'tu', to: 'den' },
  StockItemViewDto: {
    name: 'ten',
    unit: 'donVi',
    available: 'khaDung',
    toPurchase: 'canNhap',
    stockStatus: 'tinhTrang',
  },
  PurchaseNeedViewDto: { name: 'ten', unit: 'donVi', toPurchase: 'canNhap' },
  StockListResponseDto: { purchaseList: 'danhSachCanMua' },
  StockVoucherSummaryDto: {
    code: 'ma',
    createdBy: 'nguoiTao',
    lineCount: 'soDong',
    totalQty: 'tongSoLuong',
  },
  StockVoucherDetailDto: {
    code: 'ma',
    createdBy: 'nguoiTao',
    lineCount: 'soDong',
    totalQty: 'tongSoLuong',
  },
  StockVoucherLineResponseDto: { name: 'ten', unit: 'donVi' },
  StockVoucherReturnOfDto: { code: 'ma' },
  StockVoucherReturnRefDto: { code: 'ma' },
};

/** The mobile name of `field` of contract `dto` (the contract name when mobile already matches). */
export function mobileField(dto, field) {
  return WEB_TO_MOBILE_FIELD[dto]?.[field] ?? field;
}

/** The mobile name of web port method `method`. */
export function mobileMethod(method) {
  return WEB_TO_MOBILE_METHOD[method] ?? method;
}
