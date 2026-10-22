// hand-authored — the real PaymentsPort over the generated client (Story 10.5).
//
// The idempotency key is the screen's (generated once per opened form, Story 7.2) and
// travels untouched in the BODY: a retry with the same key is how the backend answers
// the same payment instead of writing a second one (NFR-1). It is never minted here,
// and never moved to a header (CORS allows only Authorization/Content-Type).
import type {
  PaymentSchedule,
  PaymentsPort,
  RecordPaymentInput,
  RecordPaymentResult,
  ReplacePaymentScheduleInput,
} from '../design-system/session/payments-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';
import type { components } from './generated/schema';

type RecordPaymentBody = components['schemas']['RecordPaymentRequestDto'];

export class HttpPaymentsPort implements PaymentsPort {
  constructor(private readonly client: ApiClient) {}

  async getSchedule(orderId: string): Promise<PaymentSchedule> {
    const { data } = await this.client.GET('/orders/{id}/payment-schedule', {
      params: { path: { id: orderId } },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async replaceSchedule(
    orderId: string,
    input: ReplacePaymentScheduleInput,
  ): Promise<PaymentSchedule> {
    const { data } = await this.client.PUT('/orders/{id}/payment-schedule', {
      params: { path: { id: orderId } },
      body: input,
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async recordPayment(orderId: string, input: RecordPaymentInput): Promise<RecordPaymentResult> {
    const { data } = await this.client.POST('/orders/{id}/payments', {
      params: { path: { id: orderId } },
      // A blank amount is the server's to reject — 400 `fieldErrors.amount`, never a client 0.
      body: input as RecordPaymentBody,
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }
}
