import { Injectable, Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventsModule } from '../src/events/events.module';
import { AuditModule } from '../src/audit/audit.module';
import { NotificationsModule } from '../src/notifications/notifications.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { EventBus } from '../src/events/event-bus';
import { PrismaService } from '../src/prisma/prisma.service';
import type { DomainEvent } from '../src/events/domain-event';

/**
 * Integration decoupling (AC-3, AD-18) — HERMETIC (override `PrismaService` no-op + spy
 * `auditLog.create`, không Postgres). Dựng `EventsModule` + `AuditModule` +
 * `NotificationsModule` thật; `app.init()` chạy `onModuleInit` → hai subscriber tự đăng ký.
 *
 * `TestProducer` CHỈ inject `EventBus` (KHÔNG tham chiếu Prisma/audit/notification). Gọi
 * `publish(event)` → assert audit được persist (auditLog.create gọi) VÀ notification được
 * dispatch (Logger.log). Chứng minh producer decoupled khỏi consumer: đổi implementation
 * dispatcher/audit KHÔNG đụng producer.
 */
@Injectable()
class TestProducer {
  constructor(private readonly eventBus: EventBus) {}

  async doBusinessAction(event: DomainEvent): Promise<void> {
    await this.eventBus.publish(event);
  }
}

describe('EventBus decoupling (integration, hermetic)', () => {
  let app: INestApplication;
  let producer: TestProducer;
  let create: jest.Mock;

  beforeAll(async () => {
    create = jest.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, EventsModule, AuditModule, NotificationsModule],
      providers: [TestProducer],
    })
      .overrideProvider(PrismaService)
      .useValue({
        auditLog: { create },
        onModuleInit: async () => {},
        onModuleDestroy: async () => {},
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init(); // chạy onModuleInit → subscriber tự đăng ký
    producer = app.get(TestProducer);
  });

  // Mỗi test tự do về số lần gọi `create` — không phụ thuộc thứ tự chạy.
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await app.close();
  });

  it('producer chỉ publish qua EventBus → audit persisted + notification dispatched', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const event: DomainEvent = {
      type: 'FakeDecoupledEvent',
      occurredAt: new Date('2026-07-09T02:00:00.000Z'),
      actorAccountId: 'acc-1',
      target: { type: 'Order', id: 'ord-1' },
    };

    await producer.doBusinessAction(event);

    // Audit persisted qua đường AuditSubscriber → AuditService → prisma.auditLog.create.
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: {
        eventType: 'FakeDecoupledEvent',
        actorAccountId: 'acc-1',
        targetType: 'Order',
        targetId: 'ord-1',
        before: undefined,
        after: undefined,
        occurredAt: event.occurredAt,
      },
    });
    // Notification dispatched qua NotificationDispatcher no-op (log).
    expect(
      logSpy.mock.calls.some((call) =>
        String(call[0]).includes('FakeDecoupledEvent'),
      ),
    ).toBe(true);
  });

  it('audit ghi lỗi → notification VẪN dispatched, publish KHÔNG reject (cô lập lỗi)', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    create.mockRejectedValueOnce(new Error('db down'));
    const event: DomainEvent = {
      type: 'AuditFailsEvent',
      occurredAt: new Date('2026-07-09T03:00:00.000Z'),
    };

    // Producer không sập vì consumer audit hỏng.
    await expect(producer.doBusinessAction(event)).resolves.toBeUndefined();

    // Lỗi audit được log (KHÔNG nuốt im lặng)...
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain('AuditFailsEvent');
    // ...và consumer còn lại (notification, đăng ký sau audit) vẫn nhận được event.
    expect(
      logSpy.mock.calls.some((call) =>
        String(call[0]).includes('AuditFailsEvent'),
      ),
    ).toBe(true);
  });
});
