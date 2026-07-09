import { AuditSubscriber } from '../src/audit/audit.subscriber';
import type { AuditService } from '../src/audit/audit.service';
import type { EventBus } from '../src/events/event-bus';
import type { DomainEvent } from '../src/events/domain-event';

/**
 * Unit `AuditSubscriber` — HERMETIC (mock EventBus + AuditService). Phủ AC-2/AC-18:
 * `onModuleInit` tự đăng ký vào port; `handle` uỷ thác `AuditService.record`.
 */
describe('AuditSubscriber (unit, hermetic)', () => {
  let subscribe: jest.Mock;
  let record: jest.Mock;
  let subscriber: AuditSubscriber;

  beforeEach(() => {
    subscribe = jest.fn();
    record = jest.fn().mockResolvedValue(undefined);
    subscriber = new AuditSubscriber(
      { subscribe } as unknown as EventBus,
      { record } as unknown as AuditService,
    );
  });

  it('onModuleInit → eventBus.subscribe(this)', () => {
    subscriber.onModuleInit();
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(subscriber);
  });

  it('handle(event) → auditService.record(event)', async () => {
    const event: DomainEvent = {
      type: 'X',
      occurredAt: new Date('2026-07-09T00:00:00.000Z'),
    };
    await subscriber.handle(event);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(event);
  });

  it('record lỗi → handle NÉM LẠI (subscriber không nuốt; InProcessEventBus cô lập + log)', async () => {
    record.mockRejectedValue(new Error('db down'));
    const event: DomainEvent = {
      type: 'X',
      occurredAt: new Date('2026-07-09T00:00:00.000Z'),
    };

    await expect(subscriber.handle(event)).rejects.toThrow('db down');
  });
});
