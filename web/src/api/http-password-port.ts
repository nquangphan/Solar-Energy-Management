// hand-authored — the real PasswordPort over the generated client (Story 10.4).
//
// A wrong current password on change-password is a 401 that the transport replays
// once after a refresh and then rejects; it never signs the user out (Story 10.3).
import type { PasswordPort } from '../design-system/session/password-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';

export class HttpPasswordPort implements PasswordPort {
  constructor(private readonly client: ApiClient) {}

  async requestResetCode(phone: string): Promise<{ expiresInSeconds: number }> {
    const { data } = await this.client.POST('/auth/forgot-password', { body: { phone } });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return { expiresInSeconds: data.expiresInSeconds };
  }

  async resetPassword(input: { phone: string; code: string; newPassword: string }): Promise<void> {
    // 204 — there is no body to read.
    await this.client.POST('/auth/reset-password', { body: input });
  }

  async changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
    await this.client.POST('/auth/change-password', { body: input });
  }
}
