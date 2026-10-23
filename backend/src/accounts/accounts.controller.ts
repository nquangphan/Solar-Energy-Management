import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentAccount,
  type AuthenticatedAccount,
} from '../auth/current-account.decorator';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { UUID_PARAM } from '../common/validation/uuid-param';
import { AccountPermissionsService } from './account-permissions.service';
import { AccountsService } from './accounts.service';
import { PERM, type PermissionKey } from './domain/permission-registry';
import type { RolePreset } from './domain/role-presets';
import { AccountPermissionSummaryDto } from './dto/account-permission-summary.dto';
import { CreateAccountRequestDto } from './dto/create-account-request.dto';
import { PermissionOptionsResponseDto } from './dto/permission-options-response.dto';
import { UpdateAccountPermissionsRequestDto } from './dto/update-account-permissions-request.dto';
import { UpdateAccountRequestDto } from './dto/update-account-request.dto';

/**
 * Permissions screen (FR-17): list accounts with their permission set, the options the caller
 * can grant, and replace one account's set. Account form (FR-16): create an account from a role
 * preset and replace an account's profile / active flag. Every handler requires `permissions.manage`; the
 * caller's own permissions are always resolved fresh from the DB by the service, never from
 * the JWT. Errors are `AppException`s — `AllExceptionsFilter` builds the envelope (AD-5).
 */
@ApiTags('accounts')
@ApiBearerAuth()
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accountPermissions: AccountPermissionsService,
    private readonly accounts: AccountsService,
  ) {}

  @Get()
  @RequirePermissions(PERM.permissionsManage)
  @ApiOkResponse({
    type: [AccountPermissionSummaryDto],
    description: 'Mọi account kèm bộ quyền, preset khớp và cờ sửa được.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu permissions.manage (FORBIDDEN).',
  })
  async list(
    @CurrentAccount() account: AuthenticatedAccount,
  ): Promise<AccountPermissionSummaryDto[]> {
    return this.accountPermissions.summaries(account.id);
  }

  // Declared before any `:id` route so "permission-options" is never read as an id.
  @Get('permission-options')
  @RequirePermissions(PERM.permissionsManage)
  @ApiOkResponse({
    type: PermissionOptionsResponseDto,
    description:
      'Registry quyền (nhãn, nhóm, phụ thuộc, cấp được không) và các preset người gọi cấp được.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu permissions.manage (FORBIDDEN).',
  })
  async permissionOptions(
    @CurrentAccount() account: AuthenticatedAccount,
  ): Promise<PermissionOptionsResponseDto> {
    return this.accountPermissions.permissionOptions(account.id);
  }

  @Put(':id/permissions')
  @RequirePermissions(PERM.permissionsManage)
  @ApiOkResponse({
    type: AccountPermissionSummaryDto,
    description: 'Account sau khi lưu bộ quyền mới.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'id không phải UUID, key ngoài registry, hoặc có quyền thiếu quyền nó cần (VALIDATION_ERROR, fieldErrors.permissions).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu permissions.manage, tự sửa quyền của mình, sửa account mang quyền người gọi không có, hoặc cấp quyền người gọi không có (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có account này (NOT_FOUND).',
  })
  async updatePermissions(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id', UUID_PARAM) id: string,
    @Body() body: UpdateAccountPermissionsRequestDto,
  ): Promise<AccountPermissionSummaryDto> {
    await this.accountPermissions.setForAccount(
      account.id,
      id,
      body.permissions as PermissionKey[],
    );
    return this.accountPermissions.summary(account.id, id);
  }

  @Post()
  @RequirePermissions(PERM.permissionsManage)
  @ApiCreatedResponse({
    type: AccountPermissionSummaryDto,
    description: 'Account mới kèm bộ quyền preset đã nạp.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu/sai field: họ tên, SĐT, email, mật khẩu, preset (VALIDATION_ERROR, fieldErrors).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu permissions.manage, hoặc preset có quyền người gọi không có (FORBIDDEN).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description:
      'SĐT hoặc email đã thuộc account khác (CONFLICT, fieldErrors.phone / .email).',
  })
  async create(
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() body: CreateAccountRequestDto,
  ): Promise<AccountPermissionSummaryDto> {
    return this.accounts.create(account.id, {
      displayName: body.displayName,
      phone: body.phone,
      email: body.email,
      password: body.password,
      preset: body.preset as RolePreset,
      isActive: body.isActive,
    });
  }

  @Put(':id')
  @RequirePermissions(PERM.permissionsManage)
  @ApiOkResponse({
    type: AccountPermissionSummaryDto,
    description: 'Account sau khi lưu hồ sơ / trạng thái (bộ quyền không đổi).',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'id không phải UUID, thiếu/sai field, hoặc gửi kèm mật khẩu (VALIDATION_ERROR, fieldErrors).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu permissions.manage, tự sửa tài khoản của mình, hoặc account mang quyền người gọi không có (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có account này (NOT_FOUND).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description:
      'SĐT hoặc email đã thuộc account khác (CONFLICT, fieldErrors.phone / .email).',
  })
  async update(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id', UUID_PARAM) id: string,
    @Body() body: UpdateAccountRequestDto,
  ): Promise<AccountPermissionSummaryDto> {
    return this.accounts.update(account.id, id, {
      displayName: body.displayName,
      phone: body.phone,
      email: body.email,
      isActive: body.isActive,
    });
  }
}
