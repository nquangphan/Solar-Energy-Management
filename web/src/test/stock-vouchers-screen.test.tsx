// Hành vi màn Phiếu kho trên JSDOM — phần smoke render (screens-render) không đo:
// loading/error/empty, chi tiết phiếu (cột giá vốn chỉ khi field có mặt), form tạo
// phiếu gửi đúng payload theo loại, lỗi 409 hiện đúng dòng, chống bấm Lưu hai lần,
// và lối vào "Phiếu kho" từ màn Tồn kho theo quyền.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PERMISSION_KEYS } from "../design-system/gating/permission-keys.generated";
import {
  DEMO_ME,
  FakeInventoryPort,
  FakeMePort,
  FakeStockVouchersPort,
  PermissionsProvider,
} from "../design-system/session";
import type {
  StockList,
  StockListQuery,
} from "../design-system/session/inventory-port";
import type {
  CreateStockVoucherInput,
  StockVoucherDetail,
  StockVoucherList,
  StockVouchersPort,
} from "../design-system/session/stock-vouchers-port";
import { InventoryScreen } from "../screens/inventory/InventoryScreen";
import { StockVouchersScreen } from "../screens/inventory/StockVouchersScreen";
import { ngayGio, ngayNgan } from "../screens/inventory/format-gio";

const ALL_PERMS = Object.values(PERMISSION_KEYS).sort();

function renderScreen(node: ReactNode, permissions: string[] = ALL_PERMS) {
  const me = new FakeMePort({ ...DEMO_ME, permissions });
  return render(<PermissionsProvider port={me}>{node}</PermissionsProvider>);
}

function renderVouchers(port: StockVouchersPort = new FakeStockVouchersPort()) {
  return renderScreen(
    <StockVouchersScreen port={port} inventoryPort={new FakeInventoryPort()} />,
  );
}

/** Cổng điều khiển tay cho danh sách: mỗi lần gọi treo tới khi test resolve/reject. */
class ManualListPort extends FakeStockVouchersPort {
  readonly calls: {
    resolve: (v: StockVoucherList) => void;
    reject: (e: Error) => void;
  }[] = [];

  override listVouchers(): Promise<StockVoucherList> {
    return new Promise((resolve, reject) => {
      this.calls.push({ resolve, reject });
    });
  }
}

/** Cổng picker điều khiển tay: mỗi lần tìm treo tới khi test trả lời — để ép trả lời cũ về muộn. */
class ManualInventoryPort extends FakeInventoryPort {
  readonly calls: { q?: string; resolve: (v: StockList) => void }[] = [];

  override listStock(query: StockListQuery = {}): Promise<StockList> {
    return new Promise((resolve) => {
      this.calls.push({ q: query.q, resolve });
    });
  }
}

async function moForm() {
  fireEvent.click(await screen.findByRole("button", { name: "Tạo phiếu" }));
  return within(screen.getByRole("dialog"));
}

afterEach(() => {
  cleanup();
});

describe("StockVouchersScreen — hành vi", () => {
  it("loading ⇒ skeleton; lỗi ⇒ ErrorState, Thử lại gọi lại cổng; rỗng ⇒ câu mời tạo phiếu", async () => {
    const port = new ManualListPort();
    const { container } = renderVouchers(port);
    expect(container.querySelectorAll(".skel").length).toBeGreaterThan(0);

    await act(async () => port.calls[0].reject(new Error("mạng")));
    expect(screen.getByText("Không tải được phiếu kho.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(port.calls.length).toBe(2);
    await act(async () => port.calls[1].resolve({ items: [] }));
    expect(
      screen.getByText("Chưa có phiếu kho nào. Bấm Tạo phiếu để bắt đầu."),
    ).toBeTruthy();
  });

  it("lọc ra rỗng ⇒ câu riêng cho bộ lọc, không phải câu kho trống", async () => {
    renderVouchers(new FakeStockVouchersPort([]));
    await screen.findByText("Chưa có phiếu kho nào. Bấm Tạo phiếu để bắt đầu.");
    fireEvent.click(screen.getByRole("link", { name: "Xuất" }));
    expect(
      await screen.findByText("Không có phiếu nào thuộc loại này."),
    ).toBeTruthy();
  });

  it("bấm phiếu nhập ⇒ chi tiết: loại, giờ UTC+7, ghi chú, +SL, cột giá vốn, notecard nhập", async () => {
    renderVouchers();
    fireEvent.click(await screen.findByText("PK-N-0119"));

    expect(await screen.findByText("06/07/2026 · 08:05")).toBeTruthy();
    expect(screen.getByText("Nhập kho")).toBeTruthy();
    expect(screen.getByText("Nhập từ nhà cung cấp")).toBeTruthy();
    expect(screen.getByText("+40")).toBeTruthy();
    expect(screen.getByText("Giá vốn / đv")).toBeTruthy();
    expect(screen.getByText("2.110.000 đ")).toBeTruthy();
    expect(screen.queryByText("2110000")).toBeNull();
    expect(screen.getByText(/không được bỏ trống/)).toBeTruthy();
  });

  it("phiếu không mang unitCost (thiếu costs.view) ⇒ không cột giá vốn, không ô '0', SL −N", async () => {
    renderVouchers();
    fireEvent.click(await screen.findByText("PK-X-0096"));

    expect(await screen.findByText("−14")).toBeTruthy();
    expect(screen.getByText("Xuất kho · không gắn đơn")).toBeTruthy();
    expect(screen.queryByText("Giá vốn / đv")).toBeNull();
    const cells = Array.from(document.querySelectorAll("td")).map(
      (td) => td.textContent,
    );
    expect(cells).not.toContain("0");
    expect(screen.getByText(/Phiếu xuất không gắn đơn/)).toBeTruthy();
  });

  it("tạo phiếu nhập ⇒ payload unitCost là số nguyên (chỉ lấy chữ số), xong chọn phiếu mới", async () => {
    const port = new FakeStockVouchersPort();
    const spy = vi.spyOn(port, "createVoucher");
    renderVouchers(port);
    const sheet = await moForm();

    fireEvent.click(sheet.getByRole("button", { name: "Tồn đầu kỳ" }));
    fireEvent.click(
      await sheet.findByRole("button", {
        name: "Tấm pin AE 630W · Còn 42 tấm",
      }),
    );
    fireEvent.change(sheet.getByLabelText("SL"), { target: { value: "40" } });
    fireEvent.change(sheet.getByLabelText("Giá vốn / đv *"), {
      target: { value: "2.110.000" },
    });
    fireEvent.click(sheet.getByRole("button", { name: "Lưu phiếu" }));

    expect(await screen.findByText("PK-N-0120")).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual({
      type: "nhap",
      note: "Tồn đầu kỳ",
      lines: [{ productId: "prod-pin-ae-630", qty: 40, unitCost: 2_110_000 }],
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("chọn Xuất ⇒ ô giá vốn biến mất và payload KHÔNG có key unitCost", async () => {
    const port = new FakeStockVouchersPort();
    const spy = vi.spyOn(port, "createVoucher");
    renderVouchers(port);
    const sheet = await moForm();

    fireEvent.click(
      await sheet.findByRole("button", {
        name: "Tấm pin AE 630W · Còn 42 tấm",
      }),
    );
    expect(sheet.getByLabelText("Giá vốn / đv *")).toBeTruthy();
    fireEvent.click(sheet.getByRole("link", { name: "Xuất" }));
    expect(sheet.queryByLabelText("Giá vốn / đv *")).toBeNull();

    fireEvent.change(sheet.getByLabelText("SL"), { target: { value: "3" } });
    fireEvent.click(sheet.getByRole("button", { name: "Lưu phiếu" }));
    await screen.findByText("PK-X-0097");

    const input = spy.mock.calls[0][0] as CreateStockVoucherInput;
    expect(input.type).toBe("xuat");
    expect(input.lines[0]).not.toHaveProperty("unitCost");
  });

  it("409 xuất quá tồn ⇒ Banner hiện message backend, lỗi nằm dưới đúng dòng, sheet còn mở", async () => {
    renderVouchers();
    const sheet = await moForm();

    fireEvent.click(sheet.getByRole("link", { name: "Xuất" }));
    fireEvent.click(
      await sheet.findByRole("button", {
        name: "Battery LiFePO4 10kWh · Còn 0 bình",
      }),
    );
    fireEvent.change(sheet.getByLabelText("SL"), { target: { value: "1" } });
    fireEvent.click(sheet.getByRole("button", { name: "Lưu phiếu" }));

    expect(
      await sheet.findByText(
        "Không đủ tồn — không thể xuất quá số tồn hiện có.",
      ),
    ).toBeTruthy();
    const loiDong = sheet.getByText("Còn 0 bình, không xuất được 1.");
    expect(loiDong.closest(".pk-dong")).not.toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("phiếu nhập để trống giá vốn ⇒ payload KHÔNG có unitCost (không bịa 0) để backend báo bắt buộc", async () => {
    const port = new FakeStockVouchersPort();
    const spy = vi.spyOn(port, "createVoucher");
    renderVouchers(port);
    const sheet = await moForm();

    fireEvent.click(
      await sheet.findByRole("button", {
        name: "Tấm pin AE 630W · Còn 42 tấm",
      }),
    );
    fireEvent.change(sheet.getByLabelText("SL"), { target: { value: "2" } });
    fireEvent.click(sheet.getByRole("button", { name: "Lưu phiếu" }));
    await screen.findByText("PK-N-0120");

    const input = spy.mock.calls[0][0] as CreateStockVoucherInput;
    expect(input.type).toBe("nhap");
    expect(input.lines[0]).not.toHaveProperty("unitCost");
  });

  it("giá vốn gõ 0 thật ⇒ vẫn gửi unitCost 0", async () => {
    const port = new FakeStockVouchersPort();
    const spy = vi.spyOn(port, "createVoucher");
    renderVouchers(port);
    const sheet = await moForm();

    fireEvent.click(
      await sheet.findByRole("button", {
        name: "Tấm pin AE 630W · Còn 42 tấm",
      }),
    );
    fireEvent.change(sheet.getByLabelText("SL"), { target: { value: "2" } });
    fireEvent.change(sheet.getByLabelText("Giá vốn / đv *"), {
      target: { value: "0" },
    });
    fireEvent.click(sheet.getByRole("button", { name: "Lưu phiếu" }));
    await screen.findByText("PK-N-0120");

    expect(
      (spy.mock.calls[0][0] as CreateStockVoucherInput).lines[0].unitCost,
    ).toBe(0);
  });

  it("bỏ một dòng sau lỗi ⇒ lỗi theo chỉ số dòng bị xoá, không rơi sang sản phẩm khác", async () => {
    renderVouchers();
    const sheet = await moForm();

    fireEvent.click(sheet.getByRole("link", { name: "Xuất" }));
    fireEvent.click(
      await sheet.findByRole("button", {
        name: "Battery LiFePO4 10kWh · Còn 0 bình",
      }),
    );
    fireEvent.click(
      sheet.getByRole("button", { name: "Tấm pin AE 630W · Còn 42 tấm" }),
    );
    for (const o of sheet.getAllByLabelText("SL")) {
      fireEvent.change(o, { target: { value: "1" } });
    }
    fireEvent.click(sheet.getByRole("button", { name: "Lưu phiếu" }));
    await sheet.findByText("Còn 0 bình, không xuất được 1.");

    fireEvent.click(
      sheet.getByRole("button", { name: "Bỏ dòng Battery LiFePO4 10kWh" }),
    );

    expect(sheet.queryByText("Còn 0 bình, không xuất được 1.")).toBeNull();
    expect(sheet.queryByRole("alert")).toBeNull();
  });

  it("tạo phiếu khi đang lọc ⇒ về Tất cả và tải danh sách đúng MỘT lần", async () => {
    const port = new FakeStockVouchersPort();
    const listSpy = vi.spyOn(port, "listVouchers");
    renderVouchers(port);
    fireEvent.click(await screen.findByRole("link", { name: "Xuất" }));
    await screen.findByText("PK-X-0096");
    listSpy.mockClear();

    const sheet = await moForm();
    fireEvent.click(
      await sheet.findByRole("button", {
        name: "Tấm pin AE 630W · Còn 42 tấm",
      }),
    );
    fireEvent.change(sheet.getByLabelText("SL"), { target: { value: "1" } });
    fireEvent.change(sheet.getByLabelText("Giá vốn / đv *"), {
      target: { value: "5" },
    });
    fireEvent.click(sheet.getByRole("button", { name: "Lưu phiếu" }));

    expect((await screen.findAllByText("PK-N-0120")).length).toBeGreaterThan(0);
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(listSpy.mock.calls[0][0]).toEqual({});
  });

  it("đang gửi ⇒ nút Lưu disabled; bấm hai lần chỉ gọi cổng một lần", async () => {
    const port = new FakeStockVouchersPort();
    let xong!: (d: StockVoucherDetail) => void;
    const spy = vi
      .spyOn(port, "createVoucher")
      .mockImplementation(() => new Promise((resolve) => (xong = resolve)));
    renderVouchers(port);
    const sheet = await moForm();

    fireEvent.click(
      await sheet.findByRole("button", {
        name: "Tấm pin AE 630W · Còn 42 tấm",
      }),
    );
    fireEvent.change(sheet.getByLabelText("SL"), { target: { value: "1" } });
    fireEvent.change(sheet.getByLabelText("Giá vốn / đv *"), {
      target: { value: "1" },
    });
    const luu = sheet.getByRole("button", { name: "Lưu phiếu" });
    fireEvent.click(luu);
    fireEvent.click(luu);

    expect(spy).toHaveBeenCalledTimes(1);
    expect((luu as HTMLButtonElement).disabled).toBe(true);
    await act(async () => xong(await port.getVoucher("pk-n-0119")));
  });
});

describe("StockVouchersScreen — lọc và picker", () => {
  it("bộ lọc gửi đúng type cho cổng: Nhập ⇒ nhap, Xuất ⇒ xuat, Tất cả ⇒ không type", async () => {
    const port = new FakeStockVouchersPort();
    const spy = vi.spyOn(port, "listVouchers");
    renderVouchers(port);
    await screen.findByText("PK-N-0119");
    expect(spy).toHaveBeenLastCalledWith({});

    fireEvent.click(screen.getByRole("link", { name: "Nhập" }));
    await screen.findByText("PK-N-0119");
    expect(spy).toHaveBeenLastCalledWith({ type: "nhap" });
    expect(screen.queryByText("PK-X-0096")).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "Xuất" }));
    await screen.findByText("PK-X-0096");
    expect(spy).toHaveBeenLastCalledWith({ type: "xuat" });
    expect(screen.queryByText("PK-N-0119")).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "Tất cả" }));
    await screen.findByText("PK-N-0119");
    expect(spy).toHaveBeenLastCalledWith({});
  });

  it("ô tìm gửi q cho cổng tồn kho; trả lời CŨ về muộn không đè gợi ý mới", async () => {
    const inv = new ManualInventoryPort();
    renderScreen(
      <StockVouchersScreen
        port={new FakeStockVouchersPort()}
        inventoryPort={inv}
      />,
    );
    const sheet = await moForm();
    const o = sheet.getByLabelText("Tìm sản phẩm để thêm dòng");

    fireEvent.change(o, { target: { value: "pin" } });
    fireEvent.change(o, { target: { value: "battery" } });
    const cu = inv.calls.find((c) => c.q === "pin");
    const moi = inv.calls.find((c) => c.q === "battery");
    expect(cu).toBeDefined();
    expect(moi).toBeDefined();

    const sp = (ten: string, productId: string) => ({
      items: [
        {
          productId,
          ten,
          sku: productId,
          donVi: "cái",
          onHand: 1,
          reserved: 0,
          khaDung: 1,
          canNhap: 0,
          tinhTrang: "du" as const,
        },
      ],
      danhSachCanMua: [],
    });
    await act(async () => moi!.resolve(sp("Battery mới", "p-moi")));
    await act(async () => cu!.resolve(sp("Pin cũ", "p-cu")));

    expect(
      sheet.getByRole("button", { name: "Battery mới · Còn 1 cái" }),
    ).toBeTruthy();
    expect(sheet.queryByRole("button", { name: /Pin cũ/ })).toBeNull();
  });
});

describe("InventoryScreen — lối vào Phiếu kho", () => {
  it("có callback + quyền inventory.manage ⇒ nút Phiếu kho gọi callback", async () => {
    const mo = vi.fn();
    renderScreen(
      <InventoryScreen port={new FakeInventoryPort()} onOpenVouchers={mo} />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Phiếu kho" }));
    expect(mo).toHaveBeenCalledTimes(1);
  });

  it("thiếu inventory.manage ⇒ không có nút, dù có callback", async () => {
    renderScreen(
      <InventoryScreen
        port={new FakeInventoryPort()}
        onOpenVouchers={vi.fn()}
      />,
      ALL_PERMS.filter((k) => k !== PERMISSION_KEYS.inventoryManage),
    );
    await screen.findByText("Tồn kho · Tồn thật / Đã hứa / Khả dụng");
    expect(screen.queryByRole("button", { name: "Phiếu kho" })).toBeNull();
  });

  it("không truyền callback ⇒ không có nút", async () => {
    renderScreen(<InventoryScreen port={new FakeInventoryPort()} />);
    await screen.findByText("Tồn kho · Tồn thật / Đã hứa / Khả dụng");
    expect(screen.queryByRole("button", { name: "Phiếu kho" })).toBeNull();
  });
});

describe("ngayNgan / ngayGio — giờ Việt Nam cố định UTC+7", () => {
  it("23:30Z ⇒ sang ngày hôm sau giờ Việt Nam, không phụ thuộc múi giờ máy", () => {
    expect(ngayNgan("2026-07-05T23:30:00.000Z")).toBe("06/07");
    expect(ngayGio("2026-07-05T23:30:00.000Z")).toBe("06/07/2026 · 06:30");
    expect(ngayGio("2026-12-31T17:00:00.000Z")).toBe("01/01/2027 · 00:00");
  });

  it("chuỗi không đọc được ⇒ —", () => {
    expect(ngayNgan("khong-phai-ngay")).toBe("—");
    expect(ngayGio("")).toBe("—");
  });
});
