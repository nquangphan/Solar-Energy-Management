import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountPermissionsService } from '../accounts/account-permissions.service';
import { PERM } from '../accounts/domain/permission-registry';
import {
  CurrentAccount,
  type AuthenticatedAccount,
} from '../auth/current-account.decorator';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { AuditLogReadService } from './audit-log-read.service';
import { AuditLogListResponseDto } from './dto/audit-log-list-response.dto';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

/**
 * Audit log, READ ONLY (FR-20, AD-8): a single `GET`, no write route of any kind. Gated on the
 * `audit.read` PERMISSION, resolved fresh from the DB per request — never on a role.
 *
 * Cost fields inside the payloads (`costPrice`, `unitCost`, `giaVon…`) are dropped for a reader
 * without `costs.view`, resolved fresh the same way (the catalog and stock-voucher pattern):
 * granting `audit.read` must not open a side door to cost prices.
 */
@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(
    private readonly auditLogs: AuditLogReadService,
    private readonly accountPermissions: AccountPermissionsService,
  ) {}

  @Get()
  @RequirePermissions(PERM.auditRead)
  @ApiOkResponse({
    type: AuditLogListResponseDto,
    description:
      'Nhật ký bất biến, mới nhất trước (occurredAt giảm dần, rồi id giảm dần), phân trang. Thiếu costs.view ⇒ các dòng giá vốn bị loại khỏi changes.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'VALIDATION_ERROR: targetType lạ, from/to sai định dạng YYYY-MM-DD, from sau to (fieldErrors.to), page/pageSize ngoài khoảng.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quyền audit.read (FORBIDDEN).',
  })
  async list(
    @CurrentAccount() account: AuthenticatedAccount,
    @Query() query: ListAuditLogsQueryDto,
  ): Promise<AuditLogListResponseDto> {
    const permissions = await this.accountPermissions.listForAccount(
      account.id,
    );
    return this.auditLogs.list(query, permissions.has(PERM.costsView));
  }
}
