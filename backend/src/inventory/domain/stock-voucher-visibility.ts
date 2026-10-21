/**
 * Che giá vốn dòng phiếu kho theo quyền — DOMAIN THUẦN (khuôn `stripCostPrice` của danh mục).
 *
 * Người có `inventory.manage` mà thiếu `costs.view` (thủ kho) GHI được giá nhập nhưng không
 * ĐỌC lại được: `unitCost` bị loại HẲN key (không `0`/`null` — `0` là lời nói dối "giá vốn bằng
 * 0"). Trả bản sao; không sửa object nguồn.
 */
export function anGiaVonDongPhieu<
  L extends { unitCost?: number },
  T extends { lines: readonly L[] },
>(phieu: T, canViewCosts: boolean): T {
  if (canViewCosts) return phieu;
  return {
    ...phieu,
    lines: phieu.lines.map((dong) => {
      const visible = { ...dong };
      delete visible.unitCost;
      return visible;
    }),
  };
}
