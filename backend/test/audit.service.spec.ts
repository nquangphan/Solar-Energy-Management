import { Prisma } from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { DomainEvent } from '../src/events/domain-event';

/**
 * Unit `AuditService` — HERMETIC (mock `PrismaService`). Phủ AC-2: `record` map 5 chiều
 * event → `auditLog.create` một lần đúng shape; event thiếu actor/target → cột null/undefined
 * (system event). Append-only: service KHÔNG expose (KHÔNG gọi) `update`/`delete`/`upsert`.
 */
describe('AuditService (unit, hermetic)', () => {
  const OCCURRED_AT = new Date('2026-07-09T01:23:45.000Z');
  let create: jest.Mock;
  let update: jest.Mock;
  let del: jest.Mock;
  let upsert: jest.Mock;
  let service: AuditService;

  beforeEach(() => {
    create = jest.fn().mockResolvedValue(undefined);
    update = jest.fn();
    del = jest.fn();
    upsert = jest.fn();
    const prisma = {
      auditLog: { create, update, delete: del, upsert },
    } as unknown as PrismaService;
    service = new AuditService(prisma);
  });

  it('map đủ 5 chiều → auditLog.create gọi một lần đúng data shape', async () => {
    const event: DomainEvent = {
      type: 'OrderConfirmed',
      occurredAt: OCCURRED_AT,
      actorAccountId: 'acc-1',
      target: { type: 'Order', id: 'ord-9' },
      before: { status: 'draft' },
      after: { status: 'confirmed' },
    };

    await service.record(event);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: {
        eventType: 'OrderConfirmed',
        actorAccountId: 'acc-1',
        targetType: 'Order',
        targetId: 'ord-9',
        before: { status: 'draft' },
        after: { status: 'confirmed' },
        occurredAt: OCCURRED_AT,
      },
    });
  });

  it('system event (thiếu actor + target) → actorAccountId/targetType/targetId = null', async () => {
    const event: DomainEvent = {
      type: 'StockRecomputed',
      occurredAt: OCCURRED_AT,
    };

    await service.record(event);

    expect(create).toHaveBeenCalledWith({
      data: {
        eventType: 'StockRecomputed',
        actorAccountId: null,
        targetType: null,
        targetId: null,
        before: undefined,
        after: undefined,
        occurredAt: OCCURRED_AT,
      },
    });
  });

  it('system event CÓ target (thiếu actor) → target ghi đủ, actorAccountId null', async () => {
    const event: DomainEvent = {
      type: 'StatusChanged',
      occurredAt: OCCURRED_AT,
      target: { type: 'Order', id: 'ord-7' },
      after: { status: 'shipped' },
    };

    await service.record(event);

    expect(create).toHaveBeenCalledWith({
      data: {
        eventType: 'StatusChanged',
        actorAccountId: null,
        targetType: 'Order',
        targetId: 'ord-7',
        before: undefined,
        after: { status: 'shipped' },
        occurredAt: OCCURRED_AT,
      },
    });
  });

  it('before/after là giá trị falsy hợp lệ (false/0) KHÔNG bị bỏ — chỉ undefined mới bỏ field', async () => {
    const event: DomainEvent = {
      type: 'FlagToggled',
      occurredAt: OCCURRED_AT,
      before: false,
      after: 0,
    };

    await service.record(event);

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ before: false, after: 0 }),
    });
  });

  it('before/after = null → Prisma.JsonNull (JSON null), KHÔNG phải null trần', async () => {
    const event: DomainEvent = {
      type: 'RecordCleared',
      occurredAt: OCCURRED_AT,
      before: null,
      after: null,
    };

    await service.record(event);

    // Cột nullable Json không nhận `null` trần; null trần có thể bị Prisma từ chối và
    // lỗi đó bị bus nuốt vào log ⇒ mất audit im lặng.
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        before: Prisma.JsonNull,
        after: Prisma.JsonNull,
      }),
    });
  });

  it('auditLog.create lỗi → record NÉM LẠI (không nuốt; bus cô lập + log)', async () => {
    create.mockRejectedValue(new Error('db down'));

    await expect(
      service.record({ type: 'X', occurredAt: OCCURRED_AT }),
    ).rejects.toThrow('db down');
  });

  it('KHÔNG gọi update/delete/upsert (append-only)', async () => {
    await service.record({ type: 'X', occurredAt: OCCURRED_AT });

    expect(update).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
