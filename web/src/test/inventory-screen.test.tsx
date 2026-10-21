// Hành vi màn Tồn kho trên JSDOM — phần smoke render (screens-render) không đo:
// từng trạng thái loading/error/empty, Thử lại gọi lại cổng, ô tìm gửi `q` xuống
// cổng, vé `latest` chống trả lời cũ vẽ đè, khối cần mua ẩn khi không món nào âm,
// và mục "Kho" ở sidebar theo gate OR.
//
// Dữ liệu từ `DEMO_STOCK_LIST` (số in ra từ `tinhTonKho` backend) — không nhẩm số mới.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import {
  filterNav,
  PERM,
  type PermissionKey,
} from "../design-system/gating/permissions";
import { PERMISSION_KEYS } from "../design-system/gating/permission-keys.generated";
import {
  DEMO_ME,
  FakeMePort,
  PermissionsProvider,
} from "../design-system/session";
import { DEMO_STOCK_LIST } from "../design-system/session/fake-inventory-port";
import type {
  InventoryPort,
  StockList,
  StockListQuery,
} from "../design-system/session/inventory-port";
import { SIDEBAR_NAV } from "../design-system/shell";
import { InventoryScreen } from "../screens/inventory/InventoryScreen";

const ALL_PERMS_ME = new FakeMePort({
  ...DEMO_ME,
  permissions: Object.values(PERMISSION_KEYS).sort(),
});

function renderScreen(node: ReactNode) {
  return render(
    <PermissionsProvider port={ALL_PERMS_ME}>{node}</PermissionsProvider>,
  );
}

/** Cổng điều khiển tay: mỗi lần gọi treo tới khi test tự resolve/reject. */
class ManualInventoryPort implements InventoryPort {
  readonly calls: {
    query: StockListQuery;
    resolve: (v: StockList) => void;
    reject: (e: Error) => void;
  }[] = [];

  listStock(query: StockListQuery = {}): Promise<StockList> {
    return new Promise((resolve, reject) => {
      this.calls.push({ query, resolve, reject });
    });
  }
}

const EMPTY: StockList = { items: [], danhSachCanMua: [] };
const PIN = DEMO_STOCK_LIST.items.find(
  (i) => i.productId === "prod-pin-ae-630",
)!;
const DAY = DEMO_STOCK_LIST.items.find((i) => i.productId === "prod-day-dc-4")!;

afterEach(() => {
  cleanup();
});

describe("InventoryScreen — hành vi", () => {
  it("loading: cổng chưa trả lời ⇒ skeleton, chưa có bảng", () => {
    const port = new ManualInventoryPort();
    const { container } = renderScreen(<InventoryScreen port={port} />);

    expect(container.querySelectorAll(".skel").length).toBeGreaterThan(0);
    expect(
      screen.queryByText("Tồn kho · Tồn thật / Đã hứa / Khả dụng"),
    ).toBeNull();
  });

  it("error: hiện lỗi; bấm Thử lại gọi lại cổng và ra dữ liệu", async () => {
    const port = new ManualInventoryPort();
    renderScreen(<InventoryScreen port={port} />);

    await act(async () => port.calls[0].reject(new Error("mạng hỏng")));
    expect(screen.getByText("Không tải được tồn kho.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
    expect(port.calls).toHaveLength(2);
    await act(async () => port.calls[1].resolve(DEMO_STOCK_LIST));

    expect(screen.queryByText("Không tải được tồn kho.")).toBeNull();
    expect(
      screen.getByText("Tồn kho · Tồn thật / Đã hứa / Khả dụng"),
    ).toBeTruthy();
  });

  it('empty không tìm: câu "chưa theo dõi", không bảng nào', async () => {
    const port = new ManualInventoryPort();
    renderScreen(<InventoryScreen port={port} />);

    await act(async () => port.calls[0].resolve(EMPTY));

    expect(
      screen.getByText("Chưa có sản phẩm nào theo dõi tồn kho."),
    ).toBeTruthy();
    expect(screen.queryByText("Không có sản phẩm khớp tìm kiếm.")).toBeNull();
    expect(
      screen.queryByText("Danh sách cần mua · gộp mọi khả dụng âm"),
    ).toBeNull();
  });

  it("ô tìm gửi q xuống cổng; tìm không ra ⇒ câu riêng của tìm kiếm", async () => {
    const port = new ManualInventoryPort();
    renderScreen(<InventoryScreen port={port} />);
    await act(async () => port.calls[0].resolve(DEMO_STOCK_LIST));

    fireEvent.change(screen.getByLabelText("Tìm sản phẩm trong kho"), {
      target: { value: "khong-co" },
    });
    expect(port.calls.at(-1)!.query).toEqual({ q: "khong-co" });
    await act(async () => port.calls.at(-1)!.resolve(EMPTY));

    expect(screen.getByText("Không có sản phẩm khớp tìm kiếm.")).toBeTruthy();
    expect(
      screen.queryByText("Chưa có sản phẩm nào theo dõi tồn kho."),
    ).toBeNull();
  });

  it("trả lời cũ về SAU trả lời mới thì không vẽ đè", async () => {
    const port = new ManualInventoryPort();
    renderScreen(<InventoryScreen port={port} />);
    await act(async () => port.calls[0].resolve(DEMO_STOCK_LIST));

    const o = screen.getByLabelText("Tìm sản phẩm trong kho");
    fireEvent.change(o, { target: { value: "d" } });
    const cu = port.calls.at(-1)!;
    fireEvent.change(o, { target: { value: "dây" } });
    const moi = port.calls.at(-1)!;
    expect(moi).not.toBe(cu);

    await act(async () => moi.resolve({ items: [DAY], danhSachCanMua: [] }));
    await act(async () => cu.resolve({ items: [PIN], danhSachCanMua: [] }));

    expect(screen.getByText(DAY.ten)).toBeTruthy();
    expect(screen.queryByText(PIN.ten)).toBeNull();
  });

  it('có sản phẩm nhưng không món nào âm ⇒ ẩn danh sách cần mua; "het"/"du" hiện số khả dụng', async () => {
    const khongAm = DEMO_STOCK_LIST.items.filter((i) => i.tinhTrang !== "am");
    const port = new ManualInventoryPort();
    renderScreen(<InventoryScreen port={port} />);

    await act(async () =>
      port.calls[0].resolve({ items: khongAm, danhSachCanMua: [] }),
    );

    expect(
      screen.getByText("Tồn kho · Tồn thật / Đã hứa / Khả dụng"),
    ).toBeTruthy();
    expect(
      screen.queryByText("Danh sách cần mua · gộp mọi khả dụng âm"),
    ).toBeNull();
    expect(screen.getByText("Hết khả dụng")).toBeTruthy();
    expect(screen.getAllByText("Đủ").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        `Còn ${PIN.onHand} · Đã hứa ${PIN.reserved} · Khả dụng ${PIN.khaDung} ${PIN.donVi}`,
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Cần nhập/)).toBeNull();
  });
});

describe("Sidebar — mục Kho theo gate OR", () => {
  const coKho = (keys: PermissionKey[]) =>
    filterNav(SIDEBAR_NAV, new Set(keys))
      .flatMap((s) => s.links)
      .some((l) => l.key === "inventory");

  it("một trong hai key là đủ để thấy Kho", () => {
    expect(coKho([PERM.inventoryManage])).toBe(true);
    expect(coKho([PERM.quotesCreateEdit])).toBe(true);
  });

  it("thiếu cả hai key ⇒ không thấy Kho", () => {
    expect(coKho([PERM.ordersViewOwn])).toBe(false);
    expect(coKho([])).toBe(false);
  });
});
