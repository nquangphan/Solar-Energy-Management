import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { EventBus } from '../events/event-bus';
import { PrismaService } from '../prisma/prisma.service';
import { StoragePort } from '../storage/storage.port';
import { QuoteExported } from './domain/order-events';
import { resolveOrderTotals } from './domain/order-totals';
import { quoteNumberOf } from './domain/quote-number';
import { OrdersService } from './orders.service';
import { QuoteRendererPort } from './quote/quote-renderer.port';
import { buildQuoteHtml } from './quote/quote-template';

/**
 * Xuất báo giá PDF + ảnh (Story 4.8, FR-21) — service RIÊNG, KHÔNG nằm trong
 * `orders.service.ts`: file đó tuyên bố bất biến "đúng 2 dependency (Prisma + EventBus)",
 * còn export cần thêm `StoragePort` + `QuoteRendererPort` + chính `OrdersService`
 * (tái dùng đường đọc `getScoped()` per-line snapshot-first — KHÔNG viết resolve thứ hai).
 *
 * Totals trên báo giá = `computeOrderTotals` (MỘT hàm — AD-16) với resolution rule:
 *  - vatRate/applyVat: version snapshot khi đã chốt (`OrderVersion.vatRate`/`vatMode`),
 *    else `Order.vatMode` + rate settings controller truyền per request (mirror `confirm()`).
 *  - discountAmount: `version.discountAmount` snapshot; chưa snapshot → approval hiệu lực
 *    (status đơn ≠ 'baogia' và approval mới nhất `cho_duyet`/`dong_y`) → amount, else 0 —
 *    mirror `refreshTotals` FE 4.7: thứ khách thấy trên màn = thứ in ra giấy.
 *
 * Pipeline: render → upload ×2 → upsert `QuoteExport` → publish `QuoteExported` (AD-18 —
 * AuditSubscriber tự ghi). Fail ở bước nào dừng ở đó — KHÔNG event khi chưa thành công
 * trọn vẹn. Key R2 DETERMINISTIC (`quotes/{orderId}/bao-gia.png|.pdf`) — xuất lần n đè
 * file cũ, MỘT bộ file mới nhất mỗi Đơn, không rác R2.
 */
@Injectable()
export class QuoteExportService {
  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    private readonly storage: StoragePort,
    private readonly renderer: QuoteRendererPort,
  ) {}

  async exportQuote(
    actorAccountId: string,
    orderId: string,
    vatRatePercent: number,
    tieredPricingEnabled: boolean,
    actorPermissions: ReadonlySet<string>,
  ) {
    // 404 (đơn ma HOẶC ngoài phạm vi — cùng thông điệp) tự có từ getScoped(), TRƯỚC khi
    // render/upload R2/ghi `quoteExport`; view mang lineItems (amount server tính) + discount.
    const order = await this.orders.getScoped(
      actorAccountId,
      actorPermissions,
      orderId,
      tieredPricingEnabled,
    );
    if (order.lineItems.length === 0) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Không thể xuất báo giá chưa có dòng nào.',
      );
    }
    // Có ≥1 dòng ⇒ currentVersionId chắc chắn khác null (dòng thuộc bản hiệu lực).
    const versionId = order.currentVersionId as string;
    const [customer, version] = await Promise.all([
      this.prisma.customer.findUnique({ where: { sdt: order.customerSdt } }),
      this.prisma.orderVersion.findUnique({ where: { id: versionId } }),
    ]);
    if (customer === null || version === null) {
      // FK bảo đảm cả hai tồn tại — nhánh này chỉ là phòng dữ liệu hỏng.
      throw new AppException(ErrorCode.NOT_FOUND, 404, 'Không tìm thấy đơn.');
    }

    // Resolution rule totals — xem doc đầu file (shared with the payment schedule).
    const { totals, vatRate, applyVat } = resolveOrderTotals({
      lines: order.lineItems.map((line) => ({
        unitPrice: line.unitPrice,
        qty: line.qty,
      })),
      version,
      order,
      fallbackVatRate: vatRatePercent,
    });

    const orderId8 = orderId.slice(0, 8);
    const fileBase = `bao-gia-${orderId8}`;
    const exportedAt = new Date();
    const html = buildQuoteHtml({
      quoteNo: quoteNumberOf(orderId),
      exportedAt,
      validityNote: order.validityNote,
      kWp: order.kWp,
      scopeThietBi: order.scopeThietBi,
      scopeThiCong: order.scopeThiCong,
      scopeVanChuyen: order.scopeVanChuyen,
      customer: {
        name: customer.name,
        sdt: customer.sdt,
        address: customer.address,
        taxCode: customer.taxCode,
      },
      lines: order.lineItems.map((line) => ({
        name: line.name,
        unit: line.unit,
        qty: line.qty,
        unitPrice: line.unitPrice,
        amount: line.amount,
        warrantyMonths: line.warrantyMonths,
      })),
      totals,
      vatRate,
      applyVat,
    });

    // Thứ tự BẮT BUỘC: render → upload ×2 → upsert → publish. Fail bước nào dừng bước đó.
    const { pdf, image } = await this.renderer.render(html);
    const imageKey = `quotes/${orderId}/bao-gia.png`;
    const pdfKey = `quotes/${orderId}/bao-gia.pdf`;
    await this.storage.putObject(imageKey, image, 'image/png');
    await this.storage.putObject(pdfKey, pdf, 'application/pdf');
    const fileMeta = {
      orderVersionId: versionId,
      imageKey,
      pdfKey,
      imageSize: image.length,
      pdfSize: pdf.length,
      fileName: fileBase,
    };
    await this.prisma.quoteExport.upsert({
      where: { orderId },
      create: { orderId, createdByAccountId: actorAccountId, ...fileMeta },
      update: fileMeta,
    });
    // occurredAt = exportedAt: audit row và response metadata cùng MỘT timestamp.
    await this.eventBus.publish(
      new QuoteExported(actorAccountId, orderId, versionId, fileBase, exportedAt),
    );

    return {
      orderId,
      orderVersionId: versionId,
      exportedAt,
      image: { fileName: `${fileBase}.png`, size: image.length },
      pdf: { fileName: `${fileBase}.pdf`, size: pdf.length },
    };
  }

  /**
   * Đọc file đã xuất cho 2 route proxy (AD-3) — chưa xuất lần nào ⇒ 404.
   *
   * Phạm vi chạy TRƯỚC khi đọc hồ sơ xuất và TRƯỚC khi chạm R2: đơn ngoài phạm vi trả CÙNG 404
   * "không tìm thấy đơn" như đơn không tồn tại — báo "chưa xuất" sẽ xác nhận đơn có thật.
   */
  async getExportFile(
    callerAccountId: string,
    actorPermissions: ReadonlySet<string>,
    orderId: string,
    kind: 'anh' | 'pdf',
  ): Promise<{ body: Buffer; contentType: string; fileName: string }> {
    await this.orders.assertScoped(callerAccountId, actorPermissions, orderId);
    const row = await this.prisma.quoteExport.findUnique({
      where: { orderId },
    });
    if (row === null) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        'Đơn này chưa xuất báo giá.',
      );
    }
    const { body } = await this.storage.getObject(
      kind === 'anh' ? row.imageKey : row.pdfKey,
    );
    return kind === 'anh'
      ? { body, contentType: 'image/png', fileName: `${row.fileName}.png` }
      : {
          body,
          contentType: 'application/pdf',
          fileName: `${row.fileName}.pdf`,
        };
  }
}
