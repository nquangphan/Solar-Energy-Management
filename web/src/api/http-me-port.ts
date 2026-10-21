// hand-authored — the real MePort over the generated client (Story 10.4).
import type { MePort, MeResponse } from '../design-system/session/me-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';

export class HttpMePort implements MePort {
  constructor(private readonly client: ApiClient) {}

  async fetchMe(): Promise<MeResponse> {
    const { data } = await this.client.GET('/me');
    // A non-ok response already threw in the transport; an ok one without a body is a broken backend.
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }
}
