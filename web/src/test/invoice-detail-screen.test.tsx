// Behaviour of the Xem hoá đơn screen on JSDOM: the invoice document (number, UTC+7
// date, linked order, seller with "Chưa cấu hình", customer, lines and totals through
// Money), the optional discount and VAT rows, the PDF status, "Xuất PDF" (export →
// download → share, one call per click), refusals verbatim, the share fallback, and
// loading / error states.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PERMISSION_KEYS } from "../design-system/gating/permission-keys.generated";
import {
  DEMO_INVOICE_SUMMARY,
  DEMO_ME,
  FakeInvoicesPort,
  FakeMePort,
  PermissionsProvider,
} from "../design-system/session";
import type { FakeInvoicesOptions } from "../design-system/session/fake-invoices-port";
import type { InvoicesPort } from "../design-system/session/invoices-port";
import { InvoiceDetailScreen } from "../screens/invoices/InvoiceDetailScreen";

const ALL_PERMS = Object.values(PERMISSION_KEYS).sort();
const INVOICE_ID = DEMO_INVOICE_SUMMARY.id;

function renderScreen(node: ReactNode) {
  const me = new FakeMePort({ ...DEMO_ME, permissions: ALL_PERMS });
  return render(<PermissionsProvider port={me}>{node}</PermissionsProvider>);
}

/** A port holding the demo invoice, issued at 18:30Z (next day in UTC+7). */
function fakePort(options: FakeInvoicesOptions = {}) {
  return new FakeInvoicesPort({
    invoices: [DEMO_INVOICE_SUMMARY],
    ...options,
    detail: {
      issuedAt: "2026-07-05T18:30:00.000Z",
      quoteNo: "BG-3F2A9B1C",
      versionNo: 2,
      ...options.detail,
    },
  });
}

const renderDetail = (port: InvoicesPort) =>
  renderScreen(
    <InvoiceDetailScreen port={port} orderId="DH-2048" invoiceId={INVOICE_ID} />,
  );

const pageText = () => (document.body.textContent ?? "").replace(/\s+/g, " ");

/** shareFiles falls back to an object-URL download in JSDOM; capture the file. */
function stubDownload() {
  const create = vi.fn((_file: File) => "blob:fake");
  Object.defineProperty(URL, "createObjectURL", {
    value: create,
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: vi.fn(),
    configurable: true,
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  return create;
}

const exportButton = () => screen.findByRole("button", { name: /Xuất PDF/ });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "canShare", {
    value: undefined,
    configurable: true,
  });
});

describe("InvoiceDetailScreen — document", () => {
  it("shows number, UTC+7 date, linked order, seller, customer, 4 lines and totals through Money", async () => {
    renderDetail(fakePort());
    expect(await screen.findByText("HD-2026-0001")).toBeTruthy();
    const text = pageText();
    expect(text).toContain("Hoá đơn bán hàng");
    expect(text).toContain("HOÁ ĐƠN BÁN HÀNG");
    expect(text).toContain("06/07/2026");
    expect(text).toContain("BG-3F2A9B1C · Bản 2");
    expect(text).toContain("CÔNG TY NLMT PHƯƠNG NAM");
    expect(text).toContain("0312998771");
    // Address, phone and bank account were empty when the invoice was issued.
    expect(screen.getAllByText("Chưa cấu hình")).toHaveLength(3);
    expect(text).toContain("VP Công Chứng Lê Đình Thao");
    expect(text).toContain("0316552018");
    expect(text).toContain("122 Trần Não, TP. Thủ Đức");
    for (const name of [
      "Tấm pin AE 630W",
      "Inverter Solplanet ASW8000-S",
      "Vật tư (gói)",
      "Công lắp đặt",
    ]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(screen.getAllByRole("row")).toHaveLength(5);
    expect(text).toContain("2.583.000 đ");
    expect(text).toContain("36.162.000 đ");
    expect(text).toContain("Tổng trước VAT");
    expect(text).toContain("76.862.000 đ");
    expect(text).toContain("VAT 8%");
    expect(text).toContain("6.148.960 đ");
    expect(text).toContain("Tổng thanh toán");
    expect(text).toContain("83.010.960 đ");
    expect(text).not.toContain("Chiết khấu");
    expect(text).not.toContain("Không áp VAT");
    expect(text).toContain(
      "Hoá đơn nội bộ — không tích hợp nhà cung cấp hoá đơn điện tử (Phase sau).",
    );
    // Short labels that also sit inside longer ones: matched as whole elements.
    expect(screen.getByText("HOÁ ĐƠN")).toBeTruthy();
    expect(screen.getByText("MST")).toBeTruthy();
  });

  it('a customer without tax code or address ⇒ "Không có MST", no address row', async () => {
    renderDetail(
      fakePort({ detail: { customerTaxCode: null, customerAddress: null } }),
    );
    expect(await screen.findByText("Không có MST")).toBeTruthy();
    // The only "Địa chỉ" left is the seller's.
    expect(screen.getAllByText("Địa chỉ")).toHaveLength(1);
  });

  it("a discount above zero ⇒ a Chiết khấu row through Money", async () => {
    renderDetail(fakePort({ detail: { discountAmount: 1_862_000 } }));
    expect(await screen.findByText("Chiết khấu")).toBeTruthy();
    expect(pageText()).toContain("1.862.000 đ");
  });

  it('applyVat false ⇒ "Không áp VAT"', async () => {
    renderDetail(fakePort({ detail: { applyVat: false, vatAmount: 0 } }));
    expect(await screen.findByText("Không áp VAT")).toBeTruthy();
    expect(pageText()).not.toContain("VAT 8%");
  });

  it('a seller fully configured ⇒ no "Chưa cấu hình"', async () => {
    renderDetail(
      fakePort({
        detail: {
          seller: {
            legalName: "CÔNG TY TNHH PHƯƠNG NAM SOLAR",
            taxCode: "0312345678",
            address: "12 Nguyễn Huệ",
            representative: "Trần Văn A",
            representativeTitle: "Giám đốc",
            phone: "0909000000",
            bankAccount: "0011 VCB",
          },
        },
      }),
    );
    expect(await screen.findByText("12 Nguyễn Huệ")).toBeTruthy();
    expect(screen.queryByText("Chưa cấu hình")).toBeNull();
  });
});

describe("InvoiceDetailScreen — PDF", () => {
  it('not exported ⇒ "Chưa xuất PDF"; exported ⇒ "Đã xuất PDF · dd/MM/yyyy" (UTC+7)', async () => {
    renderDetail(fakePort());
    expect(await screen.findByText("Chưa xuất PDF")).toBeTruthy();
    cleanup();
    renderDetail(
      fakePort({
        detail: {
          pdf: {
            fileName: "hoa-don-HD-2026-0001.pdf",
            pdfSize: 48_213,
            exportedAt: "2026-12-31T18:00:00.000Z",
          },
        },
      }),
    );
    expect(await screen.findByText("Đã xuất PDF · 01/01/2027")).toBeTruthy();
  });

  it("Xuất PDF ⇒ export once, download, share the named file, reload shows Đã xuất PDF", async () => {
    const created = stubDownload();
    const port = fakePort();
    const exportSpy = vi.spyOn(port, "exportInvoicePdf");
    const downloadSpy = vi.spyOn(port, "downloadInvoicePdf");
    renderDetail(port);

    fireEvent.click(await exportButton());

    expect(await screen.findByText("Đã xuất PDF · 22/10/2026")).toBeTruthy();
    expect(exportSpy).toHaveBeenCalledTimes(1);
    expect(exportSpy).toHaveBeenCalledWith("DH-2048", INVOICE_ID);
    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(created).toHaveBeenCalledTimes(1);
    expect((created.mock.calls[0][0] as File).name).toBe(
      "hoa-don-HD-2026-0001.pdf",
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("uses the native share sheet when files can be shared", async () => {
    const share = vi.fn((_data: ShareData) => Promise.resolve());
    Object.defineProperty(navigator, "canShare", {
      value: () => true,
      configurable: true,
    });
    Object.defineProperty(navigator, "share", {
      value: share,
      configurable: true,
    });
    renderDetail(fakePort());

    fireEvent.click(await exportButton());

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const files = share.mock.calls[0][0].files as File[];
    expect(files.map((f) => f.name)).toEqual(["hoa-don-HD-2026-0001.pdf"]);
  });

  it("two fast clicks ⇒ one export call; the button is disabled while in flight", async () => {
    stubDownload();
    const port = fakePort();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const real = port.exportInvoicePdf.bind(port);
    const exportSpy = vi
      .spyOn(port, "exportInvoicePdf")
      .mockImplementation(async (o, i) => {
        await gate;
        return real(o, i);
      });
    renderDetail(port);

    const button = (await exportButton()) as HTMLButtonElement;
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(button.disabled).toBe(true));
    release();

    expect(await screen.findByText(/Đã xuất PDF · /)).toBeTruthy();
    expect(exportSpy).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(false);
  });

  it("a server refusal is shown verbatim", async () => {
    renderDetail(
      fakePort({
        exportError: {
          message: "Không tìm thấy hoá đơn.",
          status: 404,
          code: "NOT_FOUND",
        },
      }),
    );

    fireEvent.click(await exportButton());

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Không tìm thấy hoá đơn.",
    );
  });

  it("a refused share (JS error) ⇒ the Vietnamese fallback, the stored file still shows", async () => {
    Object.defineProperty(navigator, "canShare", {
      value: () => true,
      configurable: true,
    });
    Object.defineProperty(navigator, "share", {
      value: () =>
        Promise.reject(
          new Error("Must be handling a user gesture to perform a share request."),
        ),
      configurable: true,
    });
    const port = fakePort();
    renderDetail(port);

    fireEvent.click(await exportButton());

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Không xuất được PDF hoá đơn. Vui lòng thử lại.",
    );
    // The file was stored before the share failed: the status says so.
    expect(screen.getByText("Đã xuất PDF · 22/10/2026")).toBeTruthy();
  });
});

describe("InvoiceDetailScreen — states", () => {
  it("a slow response for the previous invoice never replaces the current one", async () => {
    const port = fakePort();
    const current = await port.getInvoice("DH-2048", INVOICE_ID);
    let releaseOld: (value: typeof current) => void = () => {};
    const old = new Promise<typeof current>((resolve) => {
      releaseOld = resolve;
    });
    vi.spyOn(port, "getInvoice").mockImplementation((_orderId, invoiceId) =>
      invoiceId === "invoice-old"
        ? old
        : Promise.resolve({ ...current, invoiceNo: "HD-2026-0002" }),
    );
    const { rerender } = renderScreen(
      <InvoiceDetailScreen port={port} orderId="DH-2048" invoiceId="invoice-old" />,
    );
    const me = new FakeMePort({ ...DEMO_ME, permissions: ALL_PERMS });
    rerender(
      <PermissionsProvider port={me}>
        <InvoiceDetailScreen port={port} orderId="DH-2048" invoiceId={INVOICE_ID} />
      </PermissionsProvider>,
    );
    expect(await screen.findByText("HD-2026-0002")).toBeTruthy();
    releaseOld({ ...current, invoiceNo: "HD-2026-0001" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("HD-2026-0001")).toBeNull();
    expect(screen.getByText("HD-2026-0002")).toBeTruthy();
  });

  it("loading shows skeletons", () => {
    renderDetail(fakePort());
    expect(document.querySelectorAll(".skel").length).toBeGreaterThan(0);
  });

  it("a load failure ⇒ ErrorState, Thử lại reloads", async () => {
    const port = fakePort({
      getInvoiceError: { message: "x", status: 500 },
    });
    renderDetail(port);
    expect(await screen.findByText("Không tải được hoá đơn.")).toBeTruthy();

    const spy = vi
      .spyOn(port, "getInvoice")
      .mockResolvedValueOnce(
        await fakePort().getInvoice("DH-2048", INVOICE_ID),
      );
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));

    expect(await screen.findByText("HD-2026-0001")).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("an unknown invoice or one of another order ⇒ the fake refuses it like the backend (404)", async () => {
    await expect(
      fakePort().getInvoice("DH-2048", "invoice-unknown"),
    ).rejects.toMatchObject({ status: 404, message: "Không tìm thấy hoá đơn." });
    const port = fakePort();
    await port.getInvoice("DH-2048", INVOICE_ID);
    for (const call of [
      () => port.getInvoice("DH-OTHER", INVOICE_ID),
      () => port.exportInvoicePdf("DH-OTHER", INVOICE_ID),
      () => port.downloadInvoicePdf("DH-OTHER", INVOICE_ID),
    ]) {
      await expect(call()).rejects.toMatchObject({
        status: 404,
        message: "Không tìm thấy hoá đơn.",
      });
    }
    await expect(
      fakePort().downloadInvoicePdf("DH-2048", INVOICE_ID),
    ).rejects.toMatchObject({
      status: 404,
      message: "Hoá đơn này chưa xuất PDF.",
    });
  });

  it("the fake exports once: a second export returns the same file", async () => {
    const port = fakePort();
    const first = await port.exportInvoicePdf("DH-2048", INVOICE_ID);
    const second = await port.exportInvoicePdf("DH-2048", INVOICE_ID);
    expect(second).toEqual(first);
  });

  it("an invoice created through the fake can be opened (one store)", async () => {
    const port = new FakeInvoicesPort();
    const created = await port.createInvoice("DH-2048");
    await expect(port.getInvoice("DH-2048", created.id)).resolves.toMatchObject(
      { id: created.id, invoiceNo: created.invoiceNo },
    );
  });
});
