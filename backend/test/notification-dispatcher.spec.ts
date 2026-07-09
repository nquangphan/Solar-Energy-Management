import { Logger } from '@nestjs/common';
import { NotificationDispatcher } from '../src/notifications/notification-dispatcher';
import type { EventBus } from '../src/events/event-bus';
import type { DomainEvent } from '../src/events/domain-event';

/**
 * Unit `NotificationDispatcher` — HERMETIC (mock EventBus, spy Logger). Phủ AC-1 "no-op/log":
 * `onModuleInit` tự đăng ký; `handle` CHỈ log (bằng chứng port hoạt động), KHÔNG side-effect
 * khác (không mạng/FCM — không có `firebase-admin` trong deps).
 */
describe('NotificationDispatcher (unit, hermetic)', () => {
  let subscribe: jest.Mock;
  let dispatcher: NotificationDispatcher;

  beforeEach(() => {
    subscribe = jest.fn();
    dispatcher = new NotificationDispatcher({
      subscribe,
    } as unknown as EventBus);
  });

  afterEach(() => jest.restoreAllMocks());

  it('onModuleInit → eventBus.subscribe(this)', () => {
    dispatcher.onModuleInit();
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(dispatcher);
  });

  it('handle(event) → CHỈ Logger.log kèm event.type (no-op)', () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const event: DomainEvent = {
      type: 'OrderConfirmed',
      occurredAt: new Date('2026-07-09T00:00:00.000Z'),
    };

    dispatcher.handle(event);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain('OrderConfirmed');
  });

  it('handle trả về đồng bộ, KHÔNG log error/warn kể cả với event mang payload (no-op thuần)', () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const event: DomainEvent = {
      type: 'PaymentRecorded',
      occurredAt: new Date('2026-07-09T00:00:00.000Z'),
      actorAccountId: 'acc-1',
      target: { type: 'Payment', id: 'pay-1' },
      before: { paid: 0 },
      after: { paid: 1_000_000 },
    };

    // Không Promise → không có công việc async ngầm (mạng/FCM) nào được khởi tạo.
    expect(dispatcher.handle(event)).toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
