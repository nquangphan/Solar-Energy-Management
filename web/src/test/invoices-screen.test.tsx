// Behaviour of the Hoá đơn bán hàng screen on JSDOM: the source frame, blocked and
// already-invoiced banners, the confirm dialog, the one-call guarantee, a refusal shown
// verbatim, the created list (UTC+7 dates), empty/loading/error states; and the
// "Hoá đơn" entry on the order detail screen.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PERMISSION_KEYS } from "../design-system/gating/permission-keys.generated";
import {
  DEMO_INVOICE_SUMMARY,
  DEMO_ME,
  FakeInvoicesPort,
  FakeMePort,
  FakeOrdersPort,
  PermissionsProvider,
} from "../design-system/session";
import type {
  InvoicesPort,
  InvoiceSummary,
} from "../design-system/session/invoices-port";
import { InvoicesScreen } from "../screens/invoices/InvoicesScreen";
import { OrderDetailScreen } from "../screens/orders/OrderDetailScreen";

const ALL_PERMS = Object.values(PERMISSION_KEYS).sort();

function renderScreen(node: ReactNode) {
  const me = new FakeMePort({ ...DEMO_ME, permissions: ALL_PERMS });
  return render(<PermissionsProvider port={me}>{node}</PermissionsProvider>);
}

const renderInvoices = (port: InvoicesPort) =>
  renderScreen(<InvoicesScreen port={port} orderId="DH-2048" />);

const pageText = () => (document.body.textContent ?? "").replace(/\s+/g, " ");

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const openDialog = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Tạo hoá đơn" }));
  return await screen.findByRole("dialog");
};

describe("InvoicesScreen — source frame", () => {
  it("shows snapshot version, customer, tax code, total through Money and the fixed rows", async () => {
    renderInvoices(new FakeInvoicesPort());
    expect(await screen.findByText("Tạo hoá đơn từ đơn")).toBeTruthy();
    const text = pageText();
    expect(text).toContain("Bản 1 (snapshot)");
    expect(text).toContain("VP Công Chứng Lê Đình Thao");
    expect(text).toContain("0316552018");
    expect(text).toContain("83.010.960 đ");
    expect(text).toContain("Tự cấp khi tạo");
    expect(text).toContain(
      "Hoá đơn nội bộ — không tích hợp nhà cung cấp hoá đơn điện tử (Phase sau).",
    );
    expect(text).not.toContain("Không có MST");
  });

  it('says "Không có MST" for a customer without a tax code', async () => {
    renderInvoices(new FakeInvoicesPort({ customerTaxCode: null }));
    expect(await screen.findByText("Không có MST")).toBeTruthy();
  });
});

describe("InvoicesScreen — availability", () => {
  it("blocked: warning banner with the reason and no create button", async () => {
    renderInvoices(
      new FakeInvoicesPort({
        creatable: false,
        blockedReason: "Đơn đã bị huỷ.",
      }),
    );
    expect(await screen.findByText("Đơn đã bị huỷ.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tạo hoá đơn" })).toBeNull();
  });

  it("current version already invoiced: banner with the number and no create button", async () => {
    const port = new FakeInvoicesPort();
    await port.createInvoice("DH-2048");
    renderInvoices(port);
    expect(
      await screen.findByText("Bản đơn hiện hành đã có hoá đơn HD-2026-0001."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tạo hoá đơn" })).toBeNull();
  });
});

describe("InvoicesScreen — create", () => {
  it("opens the confirm dialog with the consequence", async () => {
    renderInvoices(new FakeInvoicesPort());
    const dialog = await openDialog();
    expect(within(dialog).getByText("Tạo hoá đơn?")).toBeTruthy();
    expect(
      within(dialog).getByText(
        "Hoá đơn chụp lại bản 1 của đơn và không sửa được sau khi tạo.",
      ),
    ).toBeTruthy();
  });

  it("Huỷ makes no call", async () => {
    const port = new FakeInvoicesPort();
    const create = vi.spyOn(port, "createInvoice");
    renderInvoices(port);
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Huỷ" }));
    expect(create).toHaveBeenCalledTimes(0);
  });

  it("confirm creates exactly once even when clicked twice, then reloads the list", async () => {
    const port = new FakeInvoicesPort();
    const real = port.createInvoice.bind(port);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const create = vi
      .spyOn(port, "createInvoice")
      .mockImplementation(async (id) => {
        await gate;
        return real(id);
      });
    const overview = vi.spyOn(port, "getOverview");
    renderInvoices(port);
    const dialog = await openDialog();
    const confirm = within(dialog).getAllByRole("button", {
      name: "Tạo hoá đơn",
    })[0]!;
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(create).toHaveBeenCalledTimes(1);
    expect(overview).toHaveBeenCalledTimes(1);
    // The dialog closed; the page button is disabled while the call is in flight, so a
    // second confirm cannot even be reached.
    const pageButton = screen.getByRole("button", { name: "Tạo hoá đơn" });
    expect((pageButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(pageButton);
    expect(screen.queryByText("Tạo hoá đơn?")).toBeNull();
    release();
    expect(
      await screen.findByText(/HD-2026-0001 · Bản 1 · 22\/10\/2026/),
    ).toBeTruthy();
    expect(
      await screen.findByText("Bản đơn hiện hành đã có hoá đơn HD-2026-0001."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tạo hoá đơn" })).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
    expect(overview).toHaveBeenCalledTimes(2);
  });

  it("shows a 409 message verbatim and reloads the overview", async () => {
    const port = new FakeInvoicesPort({
      createError: {
        message: "Đơn đã thay đổi, vui lòng tải lại.",
        status: 409,
        code: "CONFLICT",
      },
    });
    const overview = vi.spyOn(port, "getOverview");
    renderInvoices(port);
    const dialog = await openDialog();
    fireEvent.click(
      within(dialog).getAllByRole("button", { name: "Tạo hoá đơn" })[0]!,
    );
    expect(
      await screen.findByText("Đơn đã thay đổi, vui lòng tải lại."),
    ).toBeTruthy();
    await waitFor(() => expect(overview).toHaveBeenCalledTimes(2));
  });

  it("keeps the last good view when the reload after a refusal fails", async () => {
    const port = new FakeInvoicesPort({
      createError: { message: "Từ chối.", status: 409 },
    });
    renderInvoices(port);
    const dialog = await openDialog();
    vi.spyOn(port, "getOverview").mockRejectedValue({ message: "x" });
    fireEvent.click(
      within(dialog).getAllByRole("button", { name: "Tạo hoá đơn" })[0]!,
    );
    expect(await screen.findByText("Từ chối.")).toBeTruthy();
    expect(screen.getByText("Tạo hoá đơn từ đơn")).toBeTruthy();
  });

  it("a non-envelope error gets the Vietnamese fallback", async () => {
    const port = new FakeInvoicesPort();
    vi.spyOn(port, "createInvoice").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    renderInvoices(port);
    const dialog = await openDialog();
    fireEvent.click(
      within(dialog).getAllByRole("button", { name: "Tạo hoá đơn" })[0]!,
    );
    expect(
      await screen.findByText("Không tạo được hoá đơn. Vui lòng thử lại."),
    ).toBeTruthy();
    expect(pageText()).not.toContain("Failed to fetch");
  });

  it("a lost response whose invoice was created ⇒ the reload shows it and no failure banner", async () => {
    const port = new FakeInvoicesPort();
    const real = port.createInvoice.bind(port);
    vi.spyOn(port, "createInvoice").mockImplementation(async (id) => {
      await real(id);
      throw new TypeError("Failed to fetch");
    });
    renderInvoices(port);
    const dialog = await openDialog();
    fireEvent.click(
      within(dialog).getAllByRole("button", { name: "Tạo hoá đơn" })[0]!,
    );
    expect(
      await screen.findByText("Bản đơn hiện hành đã có hoá đơn HD-2026-0001."),
    ).toBeTruthy();
    expect(pageText()).not.toContain(
      "Không tạo được hoá đơn. Vui lòng thử lại.",
    );
  });

  it("a server refusal stays on screen after the reload", async () => {
    const port = new FakeInvoicesPort({
      createError: {
        message: "Đơn vừa thay đổi.",
        status: 409,
        code: "CONFLICT",
      },
    });
    renderInvoices(port);
    const dialog = await openDialog();
    fireEvent.click(
      within(dialog).getAllByRole("button", { name: "Tạo hoá đơn" })[0]!,
    );
    expect(await screen.findByText("Đơn vừa thay đổi.")).toBeTruthy();
  });
});

describe("InvoicesScreen — created list", () => {
  it("renders number, version, UTC+7 date (18:30Z rolls to the next day) and total", async () => {
    const invoice: InvoiceSummary = {
      ...DEMO_INVOICE_SUMMARY,
      issuedAt: "2026-10-21T18:30:00Z",
    };
    renderInvoices(new FakeInvoicesPort({ invoices: [invoice] }));
    expect(
      await screen.findByText("HD-2026-0001 · Bản 1 · 22/10/2026"),
    ).toBeTruthy();
    expect(pageText()).toContain("83.010.960 đ");
    expect(screen.queryByText("Chưa tạo hoá đơn nào.")).toBeNull();
  });

  it("empty list shows the empty state", async () => {
    renderInvoices(new FakeInvoicesPort());
    expect(await screen.findByText("Chưa tạo hoá đơn nào.")).toBeTruthy();
  });

  it("shows a skeleton while loading", () => {
    const port = new FakeInvoicesPort();
    vi.spyOn(port, "getOverview").mockReturnValue(new Promise(() => {}));
    renderInvoices(port);
    expect(screen.queryByText("Tạo hoá đơn từ đơn")).toBeNull();
    expect(document.querySelector(".iv-state")).not.toBeNull();
  });

  it('load error shows the error state and "Thử lại" reloads', async () => {
    const port = new FakeInvoicesPort();
    const overview = vi
      .spyOn(port, "getOverview")
      .mockRejectedValueOnce({ message: "boom", status: 500 });
    renderInvoices(port);
    fireEvent.click(await screen.findByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Tạo hoá đơn từ đơn")).toBeTruthy();
    expect(overview).toHaveBeenCalledTimes(2);
  });
});

describe('OrderDetailScreen — "Hoá đơn" entry', () => {
  async function seeded() {
    const port = new FakeOrdersPort();
    const order = await port.create({ customerPhone: "+84903176968" });
    // Every other condition that opens the actions block is OFF.
    vi.spyOn(port, "getLifecycle").mockResolvedValue({
      steps: [],
      nextSteps: [],
      canCancel: false,
    });
    return { port, order };
  }

  it("the callback alone opens the block and is called once on click", async () => {
    const { port, order } = await seeded();
    const onOpen = vi.fn();
    renderScreen(
      <OrderDetailScreen
        port={port}
        orderId={order.id}
        onOpenInvoices={onOpen}
      />,
    );
    const button = await screen.findByRole("button", { name: "Hoá đơn" });
    const actions = document.querySelector(".od-actions") as HTMLElement;
    expect(within(actions).getAllByRole("button")).toHaveLength(1);
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("absent when only onOpenContracts is passed", async () => {
    const { port, order } = await seeded();
    renderScreen(
      <OrderDetailScreen
        port={port}
        orderId={order.id}
        onOpenContracts={() => {}}
      />,
    );
    expect(
      await screen.findByRole("button", { name: "Hợp đồng" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Hoá đơn" })).toBeNull();
  });

  it('sits after "Hợp đồng" when both are passed', async () => {
    const { port, order } = await seeded();
    renderScreen(
      <OrderDetailScreen
        port={port}
        orderId={order.id}
        onOpenContracts={() => {}}
        onOpenInvoices={() => {}}
      />,
    );
    await screen.findByRole("button", { name: "Hoá đơn" });
    const actions = document.querySelector(".od-actions") as HTMLElement;
    const names = within(actions)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(names).toEqual(["Hợp đồng", "Hoá đơn"]);
  });
});

describe('InvoicesScreen — "Xem" opens a created invoice', () => {
  it("with onOpenInvoice: one Xem per created invoice, the click passes its id", async () => {
    const opened = vi.fn();
    renderScreen(
      <InvoicesScreen
        port={new FakeInvoicesPort({ invoices: [DEMO_INVOICE_SUMMARY] })}
        orderId="DH-2048"
        onOpenInvoice={opened}
      />,
    );
    const view = await screen.findByRole("button", { name: "Xem" });
    expect(screen.getAllByRole("button", { name: "Xem" })).toHaveLength(1);

    fireEvent.click(view);

    expect(opened).toHaveBeenCalledTimes(1);
    expect(opened).toHaveBeenCalledWith(DEMO_INVOICE_SUMMARY.id);
  });

  it("without onOpenInvoice: the list is shown but has no Xem button", async () => {
    renderInvoices(new FakeInvoicesPort({ invoices: [DEMO_INVOICE_SUMMARY] }));
    // The outer condition is on: the created list really holds an invoice.
    expect(await screen.findByText(/HD-2026-0001 · Bản 1/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Xem" })).toBeNull();
  });
});
