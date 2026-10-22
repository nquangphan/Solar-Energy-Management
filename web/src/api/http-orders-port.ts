// hand-authored — the real OrdersPort over the generated client (Story 10.5).
//
// One generated-client call per method; no money, no status logic (AD-2/AD-16). Photos
// go up as multipart through the backend (AD-3) and come back as bytes through the
// authenticated proxy routes — no public link, no object key.
import type {
  AddOrderLineInput,
  AttachmentItem,
  CreateOrderInput,
  DiscountPendingItem,
  ApplyDiscountInput,
  Order,
  OrderLifecycle,
  OrderLine,
  OrderListQuery,
  OrderPage,
  OrdersPort,
  OrderStockCheck,
  OrderStockIssueResult,
  OrderStockIssueView,
  OrderTotals,
  OrderVersionItem,
  PreviewTotalInput,
  QuoteExportFile,
  QuoteExportFiles,
  ResolveDiscountInput,
  StatusChangeResult,
  UpdateOrderLineInput,
  UpdateOrderMetaInput,
  UpdateScopeFlagsInput,
} from '../design-system/session/orders-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';
import type { components } from './generated/schema';

type TransitionEvent = components['schemas']['StatusChangeRequestDto']['event'];

/** Multipart body: `event` (when given) and one `files` part per photo — none for an empty list. */
function photoForm(files: File[], event?: string): FormData {
  const form = new FormData();
  if (event !== undefined) form.append('event', event);
  for (const file of files) form.append('files', file, file.name);
  return form;
}

export class HttpOrdersPort implements OrdersPort {
  constructor(private readonly client: ApiClient) {}

  async create(input: CreateOrderInput): Promise<Order> {
    const { data } = await this.client.POST('/orders', { body: input });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async get(id: string): Promise<Order> {
    const { data } = await this.client.GET('/orders/{id}', { params: { path: { id } } });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async list(query: OrderListQuery): Promise<OrderPage> {
    const { data } = await this.client.GET('/orders', { params: { query } });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async getLifecycle(orderId: string): Promise<OrderLifecycle> {
    const { data } = await this.client.GET('/orders/{id}/lifecycle', {
      params: { path: { id: orderId } },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async listVersions(orderId: string): Promise<OrderVersionItem[]> {
    const { data } = await this.client.GET('/orders/{id}/versions', {
      params: { path: { id: orderId } },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data.items;
  }

  async addLine(orderId: string, input: AddOrderLineInput): Promise<OrderLine> {
    const { data } = await this.client.POST('/orders/{id}/line-items', {
      params: { path: { id: orderId } },
      body: input,
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async updateLine(orderId: string, lineId: string, input: UpdateOrderLineInput): Promise<OrderLine> {
    const { data } = await this.client.PATCH('/orders/{id}/line-items/{lineId}', {
      params: { path: { id: orderId, lineId } },
      body: input,
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async removeLine(orderId: string, lineId: string): Promise<void> {
    // 204 — there is no body to read.
    await this.client.DELETE('/orders/{id}/line-items/{lineId}', {
      params: { path: { id: orderId, lineId } },
    });
  }

  async updateScopeFlags(orderId: string, input: UpdateScopeFlagsInput): Promise<Order> {
    return this.patchOrder(orderId, input);
  }

  async updateOrderMeta(orderId: string, input: UpdateOrderMetaInput): Promise<Order> {
    return this.patchOrder(orderId, input);
  }

  async previewTotal(input: PreviewTotalInput): Promise<OrderTotals> {
    const { data } = await this.client.POST('/orders/preview-total', { body: input });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async confirmOrder(orderId: string): Promise<Order> {
    const { data } = await this.client.POST('/orders/{id}/confirm', {
      params: { path: { id: orderId } },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async reviseOrder(orderId: string): Promise<Order> {
    const { data } = await this.client.POST('/orders/{id}/reopen', {
      params: { path: { id: orderId } },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async applyDiscount(orderId: string, input: ApplyDiscountInput): Promise<Order> {
    const { data } = await this.client.POST('/orders/{id}/apply-discount', {
      params: { path: { id: orderId } },
      body: input,
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async resolveDiscount(orderId: string, input: ResolveDiscountInput): Promise<Order> {
    const { data } = await this.client.POST('/orders/{id}/resolve-discount', {
      params: { path: { id: orderId } },
      body: input,
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async listPendingDiscounts(): Promise<DiscountPendingItem[]> {
    const { data } = await this.client.GET('/orders/pending-discount-approvals');
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  /** Render (backend), then fetch both files through the JWT proxy routes — share order [image, pdf]. */
  async exportQuote(orderId: string): Promise<QuoteExportFiles> {
    const path = { id: orderId };
    const { data: exported } = await this.client.POST('/orders/{id}/export-quote', { params: { path } });
    if (!exported) throw new ApiError(GENERIC_ERROR_MESSAGE);
    const image = await this.client.GET('/orders/{id}/quote/image', { params: { path }, parseAs: 'arrayBuffer' });
    if (!image.data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    const pdf = await this.client.GET('/orders/{id}/quote/pdf', { params: { path }, parseAs: 'arrayBuffer' });
    if (!pdf.data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return {
      image: quoteFile(exported.image.fileName, image.response, image.data, 'image/png'),
      pdf: quoteFile(exported.pdf.fileName, pdf.response, pdf.data, 'application/pdf'),
    };
  }

  async transition(orderId: string, event: string, files: File[]): Promise<StatusChangeResult> {
    const { data } = await this.client.POST('/orders/{id}/transition', {
      params: { path: { id: orderId } },
      // The typed body is the DTO; the wire body is the multipart form. `event` came from
      // `getLifecycle().nextSteps` — the backend validates it against its table.
      body: { event: event as TransitionEvent },
      bodySerializer: () => photoForm(files, event),
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async cancel(orderId: string, reason: string): Promise<void> {
    const { data } = await this.client.POST('/orders/{id}/cancel', {
      params: { path: { id: orderId } },
      body: { reason },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
  }

  async listAttachments(orderId: string): Promise<AttachmentItem[]> {
    const { data } = await this.client.GET('/orders/{id}/attachments', {
      params: { path: { id: orderId } },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data.items;
  }

  async addAttachments(orderId: string, files: File[]): Promise<void> {
    const { data } = await this.client.POST('/orders/{id}/attachments', {
      params: { path: { id: orderId } },
      // Typed as the DTO; the wire body is the multipart form with one `files` part per photo.
      body: { files: [] },
      bodySerializer: () => photoForm(files),
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
  }

  async removeAttachment(orderId: string, attachmentId: string): Promise<void> {
    // 204 — there is no body to read.
    await this.client.DELETE('/orders/{id}/attachments/{attachmentId}', {
      params: { path: { id: orderId, attachmentId } },
    });
  }

  async attachmentBytes(orderId: string, attachmentId: string): Promise<Blob> {
    const { data } = await this.client.GET('/orders/{id}/attachments/{attachmentId}', {
      params: { path: { id: orderId, attachmentId } },
      parseAs: 'blob',
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async getStockIssue(orderId: string): Promise<OrderStockIssueView> {
    const { data } = await this.client.GET('/orders/{id}/stock-issue', {
      params: { path: { id: orderId } },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async issueStock(orderId: string): Promise<OrderStockIssueResult> {
    // 201 the first time, 200 on a replay of an issued order — both carry the voucher.
    const { data } = await this.client.POST('/orders/{id}/stock-issue', {
      params: { path: { id: orderId } },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async getStockCheck(orderId: string): Promise<OrderStockCheck> {
    const { data } = await this.client.GET('/orders/{id}/stock-check', {
      params: { path: { id: orderId } },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  /** `PATCH /orders/{id}` — one endpoint for both field groups; each caller names its group. */
  private async patchOrder(
    orderId: string,
    input: UpdateScopeFlagsInput | UpdateOrderMetaInput,
  ): Promise<Order> {
    const { data } = await this.client.PATCH('/orders/{id}', {
      params: { path: { id: orderId } },
      body: input,
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }
}

function quoteFile(
  fileName: string,
  response: Response,
  bytes: ArrayBuffer,
  fallbackType: string,
): QuoteExportFile {
  return {
    fileName,
    mimeType: response.headers.get('content-type') ?? fallbackType,
    bytes: new Uint8Array(bytes),
  };
}
