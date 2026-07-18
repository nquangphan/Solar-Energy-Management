/**
 * "Đổi gì" giữa hai bản update của Đơn (FR-6) — DOMAIN THUẦN: không Nest/Prisma, không async
 * (unit-test được không cần mock).
 *
 * ⚠️ Diff CHỈ về DÒNG và SỐ LƯỢNG, KHÔNG về tiền. Trước khi Chốt, đơn giá là live-resolve từ
 * danh mục (`OrdersService.toViews`) — so giá sẽ báo "đổi" cho một bản không ai đụng vào, chỉ
 * vì danh mục vừa lên giá. Một lịch sử kêu sai là một lịch sử không ai đọc nữa.
 */

/** Phần dòng mà diff cần — hẹp hơn `OrderLineItem` để test không phải dựng cả row Prisma. */
export interface DongToiThieu {
  readonly productId: string | null;
  readonly name: string;
  readonly unit: string;
  readonly qty: number;
  readonly displayOrder: number;
}

/** Thay đổi giữa bản N-1 và bản N. Bản đầu tiên ⇒ cả ba mảng rỗng. */
export interface ThayDoiBanUpdate {
  readonly them: string[];
  readonly xoa: string[];
  readonly doiSoLuong: { ten: string; tu: number; den: number }[];
}

/**
 * Khoá ghép dòng — CỐ ĐỊNH, không heuristic: `productId` khi dòng thuộc danh mục, ngược lại
 * `(tên, đơn vị)` cho dòng tự do. Hai dòng tự do cùng tên cùng đơn vị là cùng một thứ hàng.
 */
function khoaCua(dong: DongToiThieu): string {
  return dong.productId ?? `${dong.name}|${dong.unit}`;
}

/**
 * Gom dòng theo khoá, mỗi nhóm sắp theo `displayOrder` tăng dần — trùng khoá trong cùng một
 * bản thì ghép cặp theo thứ tự đó (dòng thứ nhất với dòng thứ nhất), dư ra tính là thêm/xoá.
 * Quy tắc phải TẤT ĐỊNH: một diff đổi kết quả giữa hai lần chạy là một diff vô dụng.
 */
function gomTheoKhoa(
  dong: readonly DongToiThieu[],
): Map<string, DongToiThieu[]> {
  const nhom = new Map<string, DongToiThieu[]>();
  for (const d of dong) {
    const khoa = khoaCua(d);
    const cu = nhom.get(khoa);
    if (cu === undefined) nhom.set(khoa, [d]);
    else cu.push(d);
  }
  for (const ds of nhom.values()) {
    ds.sort((a, b) => a.displayOrder - b.displayOrder);
  }
  return nhom;
}

/** Dòng nào thêm, dòng nào bị xoá, dòng nào đổi số lượng — theo TÊN hiển thị của dòng. */
export function diffDong(
  truoc: readonly DongToiThieu[],
  sau: readonly DongToiThieu[],
): ThayDoiBanUpdate {
  const nhomTruoc = gomTheoKhoa(truoc);
  const nhomSau = gomTheoKhoa(sau);
  const them: string[] = [];
  const xoa: string[] = [];
  const doiSoLuong: { ten: string; tu: number; den: number }[] = [];

  for (const [khoa, dsSau] of nhomSau) {
    const dsTruoc = nhomTruoc.get(khoa) ?? [];
    const chung = Math.min(dsTruoc.length, dsSau.length);
    for (let i = 0; i < chung; i++) {
      if (dsTruoc[i].qty !== dsSau[i].qty) {
        doiSoLuong.push({
          ten: dsSau[i].name,
          tu: dsTruoc[i].qty,
          den: dsSau[i].qty,
        });
      }
    }
    for (let i = chung; i < dsSau.length; i++) them.push(dsSau[i].name);
  }

  for (const [khoa, dsTruoc] of nhomTruoc) {
    const dsSau = nhomSau.get(khoa) ?? [];
    for (let i = dsSau.length; i < dsTruoc.length; i++) {
      xoa.push(dsTruoc[i].name);
    }
  }

  return { them, xoa, doiSoLuong };
}
