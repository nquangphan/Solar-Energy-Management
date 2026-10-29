import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { vietnamRangeToInstants } from '../dashboard/domain/dashboard-period';
import { PrismaService } from '../prisma/prisma.service';
import { auditChanges } from './domain/audit-changes';
import { auditEventLabel } from './domain/audit-event-labels';
import type { AuditLogListResponseDto } from './dto/audit-log-list-response.dto';
import type { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

const INVALID_DATE_RANGE = 'INVALID_DATE_RANGE';
const INVALID_DATE_RANGE_MESSAGE =
  'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.';

/**
 * READ side of the audit log (FR-20). Kept apart from `AuditService`, which only writes: this
 * service only uses `findMany`/`count` (the append-only guard forbids anything else on audit).
 * The permission gate (`audit.read`) sits on the controller, which also resolves
 * `canViewCosts`: cost fields are dropped from `changes` for a reader without `costs.view`.
 */
@Injectable()
export class AuditLogReadService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListAuditLogsQueryDto,
    canViewCosts: boolean,
  ): Promise<AuditLogListResponseDto> {
    if (query.from !== undefined && query.to !== undefined) {
      if (query.from > query.to) {
        throw new AppException(
          ErrorCode.VALIDATION_ERROR,
          400,
          INVALID_DATE_RANGE_MESSAGE,
          [
            {
              field: 'to',
              code: INVALID_DATE_RANGE,
              message: INVALID_DATE_RANGE_MESSAGE,
            },
          ],
        );
      }
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.targetType !== undefined) where.targetType = query.targetType;
    // Vietnam days → half-open UTC instants, each end resolved on its own day.
    const occurredAt: Prisma.DateTimeFilter = {};
    if (query.from !== undefined)
      occurredAt.gte = vietnamRangeToInstants({
        from: query.from,
        to: query.from,
      }).fromInstant;
    if (query.to !== undefined)
      occurredAt.lt = vietnamRangeToInstants({
        from: query.to,
        to: query.to,
      }).toExclusive;
    if (query.from !== undefined || query.to !== undefined)
      where.occurredAt = occurredAt;

    // One snapshot for the page and the total, so the two never disagree.
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // One lookup for every actor of the page — never one query per row.
    const actorIds = [
      ...new Set(
        rows
          .map((row) => row.actorAccountId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const actors =
      actorIds.length === 0
        ? []
        : await this.prisma.account.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, displayName: true },
          });
    const nameById = new Map(actors.map((a) => [a.id, a.displayName]));

    return {
      items: rows.map((row) => ({
        id: row.id,
        eventType: row.eventType,
        eventLabel: auditEventLabel(row.eventType),
        actorAccountId: row.actorAccountId,
        actorDisplayName:
          row.actorAccountId === null
            ? null
            : (nameById.get(row.actorAccountId) ?? null),
        targetType: row.targetType,
        targetId: row.targetId,
        occurredAt: row.occurredAt,
        changes: auditChanges(row.before, row.after, canViewCosts),
      })),
      total,
      page,
      pageSize,
    };
  }
}
