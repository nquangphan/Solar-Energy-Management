import { Logger } from '@nestjs/common';
import { InProcessEventBus } from '../src/events/in-process-event-bus';
import type { DomainEvent } from '../src/events/domain-event';
import type { EventSubscriber } from '../src/events/event-bus';

/**
 * Unit `InProcessEventBus` — HERMETIC (mock subscriber/Logger, không Postgres). Phủ AC-1/AC-3:
 * fan-out tới MỌI subscriber đúng 1 lần; cô lập lỗi (một subscriber ném → còn lại vẫn chạy +
 * lỗi được log, `publish` KHÔNG reject); không subscriber → `publish` no-op không lỗi.
 */
describe('InProcessEventBus (unit, hermetic)', () => {
  const event: DomainEvent = {
    type: 'FakeEvent',
    occurredAt: new Date('2026-07-09T00:00:00.000Z'),
  };

  let bus: InProcessEventBus;

  beforeEach(() => {
    bus = new InProcessEventBus();
  });

  afterEach(() => jest.restoreAllMocks());

  function fakeSubscriber(): EventSubscriber & { handle: jest.Mock } {
    return { handle: jest.fn() };
  }

  it('subscribe rồi publish → subscriber.handle gọi đúng 1 lần với đúng event', async () => {
    const sub = fakeSubscriber();
    bus.subscribe(sub);

    await bus.publish(event);

    expect(sub.handle).toHaveBeenCalledTimes(1);
    expect(sub.handle).toHaveBeenCalledWith(event);
  });

  it('nhiều subscriber → TẤT CẢ được fan-out với đúng event', async () => {
    const a = fakeSubscriber();
    const b = fakeSubscriber();
    bus.subscribe(a);
    bus.subscribe(b);

    await bus.publish(event);

    expect(a.handle).toHaveBeenCalledWith(event);
    expect(b.handle).toHaveBeenCalledWith(event);
  });

  it('một subscriber ném lỗi → subscriber khác VẪN chạy, lỗi được log, publish KHÔNG reject', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const boom = fakeSubscriber();
    boom.handle.mockRejectedValue(new Error('boom'));
    const survivor = fakeSubscriber();
    bus.subscribe(boom);
    bus.subscribe(survivor);

    await expect(bus.publish(event)).resolves.toBeUndefined();

    expect(survivor.handle).toHaveBeenCalledWith(event);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain('FakeEvent');
  });

  it('subscriber ném giá trị KHÔNG phải Error → vẫn log (String(err)), subscriber sau vẫn chạy', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const boom = fakeSubscriber();
    boom.handle.mockImplementation(() => {
      throw 'chuỗi lỗi trần';
    });
    const survivor = fakeSubscriber();
    bus.subscribe(boom);
    bus.subscribe(survivor);

    await expect(bus.publish(event)).resolves.toBeUndefined();

    expect(survivor.handle).toHaveBeenCalledWith(event);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    // Không có `.stack` để log → rơi về String(err).
    expect(errorSpy.mock.calls[0][1]).toBe('chuỗi lỗi trần');
  });

  it('nhiều subscriber cùng ném → mỗi lỗi log riêng, TẤT CẢ subscriber vẫn được gọi', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const first = fakeSubscriber();
    first.handle.mockRejectedValue(new Error('lỗi thứ nhất'));
    const second = fakeSubscriber();
    second.handle.mockRejectedValue(new Error('lỗi thứ hai'));
    const survivor = fakeSubscriber();
    bus.subscribe(first);
    bus.subscribe(second);
    bus.subscribe(survivor);

    await expect(bus.publish(event)).resolves.toBeUndefined();

    // Cô lập độc lập: lỗi đầu KHÔNG dừng vòng fan-out.
    expect(first.handle).toHaveBeenCalledTimes(1);
    expect(second.handle).toHaveBeenCalledTimes(1);
    expect(survivor.handle).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it('fan-out TUẦN TỰ theo thứ tự đăng ký (await lần lượt, không song song)', async () => {
    const calls: string[] = [];
    const slow: EventSubscriber = {
      handle: async () => {
        calls.push('slow:start');
        await Promise.resolve();
        calls.push('slow:end');
      },
    };
    const fast: EventSubscriber = {
      handle: () => {
        calls.push('fast');
      },
    };
    bus.subscribe(slow);
    bus.subscribe(fast);

    await bus.publish(event);

    // `slow` hoàn tất TRƯỚC khi `fast` bắt đầu — đổi sang Promise.all sẽ phá assert này.
    expect(calls).toEqual(['slow:start', 'slow:end', 'fast']);
  });

  it('không subscriber nào → publish no-op, không lỗi', async () => {
    await expect(bus.publish(event)).resolves.toBeUndefined();
  });
});
