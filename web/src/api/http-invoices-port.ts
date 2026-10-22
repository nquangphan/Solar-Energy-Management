// hand-authored — the real InvoicesPort over the generated client (Story 10.5).
import type {
  InvoiceDetail,
  InvoicePdfInfo,
  InvoicesOverview,
  InvoicesPort,
  InvoiceSummary,
} from '../design-system/session/invoices-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';
import { downloadedFile } from './download';

export class HttpInvoicesPort implements InvoicesPort {
  constructor(private readonly client: ApiClient) {}

  async getOverview(orderId: string): Promise<InvoicesOverview> {
    const { data } = await this.client.GET('/orders/{id}/invoices', {
      params: { path: { id: orderId } },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async createInvoice(orderId: string): Promise<InvoiceSummary> {
    const { data } = await this.client.POST('/orders/{id}/invoices', {
      params: { path: { id: orderId } },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async getInvoice(orderId: string, invoiceId: string): Promise<InvoiceDetail> {
    const { data } = await this.client.GET('/orders/{id}/invoices/{invoiceId}', {
      params: { path: { id: orderId, invoiceId } },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async exportInvoicePdf(orderId: string, invoiceId: string): Promise<InvoicePdfInfo> {
    const { data } = await this.client.POST('/orders/{id}/invoices/{invoiceId}/pdf', {
      params: { path: { id: orderId, invoiceId } },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async downloadInvoicePdf(orderId: string, invoiceId: string): Promise<File> {
    const { data, response } = await this.client.GET('/orders/{id}/invoices/{invoiceId}/pdf', {
      params: { path: { id: orderId, invoiceId } },
      parseAs: 'blob',
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return downloadedFile(data, response, `${invoiceId}.pdf`);
  }
}
