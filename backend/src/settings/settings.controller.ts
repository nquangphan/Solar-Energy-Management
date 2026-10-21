import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PERM } from '../accounts/domain/permission-registry';
import {
  CurrentAccount,
  type AuthenticatedAccount,
} from '../auth/current-account.decorator';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { CompanyLegalEntityDto } from './dto/company-legal-entity.dto';
import { UpdateVatRateRequestDto } from './dto/update-vat-rate-request.dto';
import { VatRateResponseDto } from './dto/vat-rate-response.dto';
import { SettingsService } from './settings.service';

/**
 * Cấu hình hệ thống (FR-3, AD-14). CẢ HAI endpoint gate `settings.manage` — khác
 * `feature-flags` (GET là `@AuthenticatedOnly`): sale KHÔNG cần endpoint này vì rate hiệu
 * lực đã về qua `POST /orders/preview-total` response (`vatRate`); chỉ MÀN CẤU HÌNH dùng.
 *
 * Controller KHÔNG dựng envelope lỗi: ném `AppException`, `AllExceptionsFilter` dựng envelope
 * (AD-5).
 */
@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('vat-rate')
  @RequirePermissions(PERM.settingsManage)
  @ApiOkResponse({
    type: VatRateResponseDto,
    description: 'Thuế suất VAT (%) hiệu lực — chưa cấu hình ⇒ 8 (default).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu settings.manage (FORBIDDEN) — sale nhận rate qua preview-total, không qua đây.',
  })
  async getVatRate(): Promise<VatRateResponseDto> {
    return { ratePercent: await this.settings.vatRatePercent() };
  }

  @Patch('vat-rate')
  @RequirePermissions(PERM.settingsManage)
  @ApiOkResponse({
    type: VatRateResponseDto,
    description: 'Thuế suất VAT (%) sau khi đổi.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'ratePercent không phải Int 0..100 (VALIDATION_ERROR) — kèm `fieldErrors`.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu settings.manage (FORBIDDEN).',
  })
  async updateVatRate(
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() body: UpdateVatRateRequestDto,
  ): Promise<VatRateResponseDto> {
    return {
      ratePercent: await this.settings.updateVatRate(
        account.id,
        body.ratePercent,
      ),
    };
  }

  @Get('company-legal-entity')
  @RequirePermissions(PERM.settingsManage)
  @ApiOkResponse({
    type: CompanyLegalEntityDto,
    description:
      'Thông tin pháp nhân công ty in trên hợp đồng. Chưa cấu hình ⇒ cả 7 ô là chuỗi rỗng (không seed).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu settings.manage (FORBIDDEN).',
  })
  async getCompanyLegalEntity(): Promise<CompanyLegalEntityDto> {
    return this.settings.companyLegalEntity();
  }

  @Put('company-legal-entity')
  @RequirePermissions(PERM.settingsManage)
  @ApiOkResponse({
    type: CompanyLegalEntityDto,
    description:
      'Thông tin pháp nhân sau khi lưu (đã trim). Thay toàn bộ 7 ô; chuỗi rỗng = xoá cấu hình ô đó. Gửi lại y hệt ⇒ không ghi gì.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu ô, ô không phải chuỗi (kể cả null), hoặc quá 200 ký tự (VALIDATION_ERROR) — kèm `fieldErrors`.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu settings.manage (FORBIDDEN).',
  })
  async updateCompanyLegalEntity(
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() body: CompanyLegalEntityDto,
  ): Promise<CompanyLegalEntityDto> {
    return this.settings.updateCompanyLegalEntity(account.id, body);
  }
}
