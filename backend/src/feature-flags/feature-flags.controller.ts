import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PERM } from '../accounts/domain/permission-registry';
import { AuthenticatedOnly } from '../auth/authenticated-only.decorator';
import {
  CurrentAccount,
  type AuthenticatedAccount,
} from '../auth/current-account.decorator';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { isFeatureFlagKey } from './domain/feature-flag-registry';
import { FeatureFlagResponseDto } from './dto/feature-flag-response.dto';
import { ToggleFeatureFlagRequestDto } from './dto/toggle-feature-flag-request.dto';
import { FeatureFlagsService } from './feature-flags.service';

/**
 * Cờ tính năng nghiệp vụ (AD-14). HAI quyền KHÁC NHAU, cố ý KHÔNG gộp:
 *
 *  - ĐỌC (`GET`) → `@AuthenticatedOnly()`. Sale dựng báo giá (Epic 4) KHÔNG có
 *    `catalog.manage` nhưng vẫn phải biết cờ đang bật để hiển thị đúng. Cờ là công tắc hệ
 *    thống, không phải dữ liệu nhạy cảm — biết "giá phân tầng đang bật" không lộ gì cả.
 *  - BẤM (`PATCH`) → `@RequirePermissions(PERM.systemFeatureFlags)`. Chỉ người vận hành app
 *    (`SUPER_ADMIN`) — bật cờ này đổi cách tính tiền của TOÀN danh mục.
 *
 * Controller KHÔNG dựng envelope lỗi: ném `AppException`, `AllExceptionsFilter` dựng envelope
 * (AD-5).
 */
@ApiTags('feature-flags')
@ApiBearerAuth()
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlags: FeatureFlagsService) {}

  @Get()
  @AuthenticatedOnly()
  @ApiOkResponse({
    type: [FeatureFlagResponseDto],
    description:
      'MỌI cờ trong registry kèm trạng thái — cờ chưa từng bấm vẫn hiện ra với enabled=false.',
  })
  async findAll(): Promise<FeatureFlagResponseDto[]> {
    return await this.featureFlags.listAll();
  }

  @Patch(':key')
  @RequirePermissions(PERM.systemFeatureFlags)
  @ApiOkResponse({
    type: FeatureFlagResponseDto,
    description: 'Trạng thái cờ sau khi bấm.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: 'Body không hợp lệ (VALIDATION_ERROR) — kèm `fieldErrors`.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu system.feature_flags (FORBIDDEN). catalog.manage KHÔNG thay thế được.',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Tên cờ không có trong registry (NOT_FOUND).',
  })
  async toggle(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('key') key: string,
    @Body() body: ToggleFeatureFlagRequestDto,
  ): Promise<FeatureFlagResponseDto> {
    // Key lạ ⇒ 404, KHÔNG âm thầm tạo cờ mới: registry là nguồn chân lý về cờ nào tồn tại,
    // và một cờ đẻ ra từ URL sẽ không có ai đọc.
    if (!isFeatureFlagKey(key)) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        'Cờ tính năng không tồn tại.',
      );
    }
    return await this.featureFlags.setEnabled(account.id, key, body.enabled);
  }
}
