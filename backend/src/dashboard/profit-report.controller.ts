import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PERM } from '../accounts/domain/permission-registry';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { ProfitReportQueryDto } from './dto/profit-report-query.dto';
import { ProfitReportResponseDto } from './dto/profit-report-response.dto';
import { ProfitReportService } from './profit-report.service';

/**
 * Gross profit report (FR-37), READ ONLY. Gated on the `costs.view` PERMISSION, resolved fresh
 * from the DB per request by the global guard — holding every order and finance permission
 * without `costs.view` is still a 403.
 */
@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ProfitReportController {
  constructor(private readonly profitReport: ProfitReportService) {}

  @Get('profit')
  @RequirePermissions(PERM.costsView)
  @ApiOkResponse({
    type: ProfitReportResponseDto,
    description:
      'Lợi nhuận gộp trên vật tư của các đơn đã xuất kho trong kỳ (không tính đơn huỷ), toàn công ty, nhóm theo groupBy. Σ rows = totals.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'VALIDATION_ERROR: groupBy/period lạ; from/to sai định dạng YYYY-MM-DD; period=custom thiếu from/to; from sau to (fieldErrors.to); from/to gửi kèm period month/year.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quyền costs.view (FORBIDDEN).',
  })
  profit(
    @Query() query: ProfitReportQueryDto,
  ): Promise<ProfitReportResponseDto> {
    return this.profitReport.report(query, new Date());
  }
}
