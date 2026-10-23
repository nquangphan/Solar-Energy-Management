// OrderStatusChangeCubit (Story 11.3): the steps, the "Đã giao" preview and the send OrderStatusChangeScreen used to hold in its State.
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/screens/orders/order_status_change_cubit.dart';
import 'package:pns_mobile/screens/orders/order_status_change_state.dart';

import 'recording_orders_port.dart';

const String _orderId = 'ord-1';

const OrderNextStep _build = OrderNextStep(event: 'bat_dau_thi_cong', to: OrderNextStepDtoTo.thicong, requires: 'x');
const OrderNextStep _deliver = OrderNextStep(event: kEventDelivered, to: OrderNextStepDtoTo.dagiao, requires: 'y');

OrderLifecycle _lifecycle(List<OrderNextStep> next) => OrderLifecycle(steps: const [], nextSteps: next, canCancel: false);

OrderStockIssueView _view(num onHand, {bool blocked = false}) => OrderStockIssueView(
      issued: false,
      canIssue: true,
      blocked: blocked,
      lines: [
        OrderStockIssueLine(productId: 'p1', name: 'Tấm pin', sku: 'PIN', unit: 'tấm', qty: 2, onHand: onHand, shortfall: 0),
      ],
      untrackedItems: const [],
    );

const StatusChangeResult _done =
    StatusChangeResult(status: StatusChangeResponseDtoStatus.dagiao, occurredAt: '2026-10-23T00:00:00.000Z', savedAttachmentCount: 2);

const OrderPortException _short = OrderPortException(
  'Không đủ tồn kho.',
  code: 'CONFLICT',
  fieldErrors: {'lines.1.qty': 'Thiếu 3 tấm.', 'note': 'x'},
);

/// A port whose lifecycle offers [next]; the preview and the send answer at once
/// unless [held], with demo values unless [errors].
RecordingOrdersPort _port(List<OrderNextStep> next, {Set<String>? held, Map<String, Object>? errors}) =>
    RecordingOrdersPort(
      held: held,
      errors: errors,
      answers: {'getLifecycle': _lifecycle(next), 'getStockIssue': _view(5), 'transition': _done},
    );

/// Loads [cubit] and lets the preview it may start settle.
Future<void> _loaded(OrderStatusChangeCubit cubit, RecordingOrdersPort port) async {
  await cubit.load();
  await pumpEventQueue();
}

/// [s] with some fields replaced — built field by field, independent of the
/// production copyWith, so an expectation cannot share its carry-over bug.
const Object _same = Object();
OrderStatusChangeState _copy(
  OrderStatusChangeState s, {
  OrderStatusChangeStatus? status,
  Object? stockIssue = _same,
  Object? previewStatus = _same,
  bool? sending,
  Object? sendError = _same,
  Map<int, String>? lineErrors,
}) =>
    OrderStatusChangeState(
      status: status ?? s.status,
      steps: s.steps,
      selected: s.selected,
      stockIssue: identical(stockIssue, _same) ? s.stockIssue : stockIssue as OrderStockIssueView?,
      previewStatus: identical(previewStatus, _same) ? s.previewStatus : previewStatus as OrderStatusChangeStatus?,
      sending: sending ?? s.sending,
      sendError: identical(sendError, _same) ? s.sendError : sendError as String?,
      lineErrors: lineErrors ?? s.lineErrors,
    );

void main() {
  test('starts loading with nothing picked, no preview, nothing sending', () {
    final cubit = OrderStatusChangeCubit(RecordingOrdersPort(), _orderId);
    expect(cubit.state, const OrderStatusChangeState());
    cubit.close();
  });

  test('one step ⇒ it is picked for the user; a step other than Đã giao loads no preview', () async {
    final port = _port([_build]);
    final cubit = OrderStatusChangeCubit(port, _orderId);
    await _loaded(cubit, port);
    expect(cubit.state, const OrderStatusChangeState(status: OrderStatusChangeStatus.ready, steps: [_build], selected: 'bat_dau_thi_cong'));
    expect(port.log, ['getLifecycle']);
    expect(port.argsOf('getLifecycle').single, [_orderId]);
    await cubit.close();
  });

  test('two steps ⇒ nothing is picked', () async {
    final port = _port([_build, _deliver]);
    final cubit = OrderStatusChangeCubit(port, _orderId);
    await _loaded(cubit, port);
    expect(cubit.state.selected, isNull);
    expect(cubit.state.steps, [_build, _deliver]);
    await cubit.close();
  });

  test('the only step is Đã giao ⇒ picked, and its preview loads', () async {
    final port = _port([_deliver]);
    final cubit = OrderStatusChangeCubit(port, _orderId);
    await _loaded(cubit, port);
    await pumpEventQueue();
    expect(port.log, ['getLifecycle', 'getStockIssue']);
    expect(cubit.state.selected, kEventDelivered);
    expect(cubit.state.previewStatus, OrderStatusChangeStatus.ready);
    await cubit.close();
  });

  test('picking Đã giao ⇒ preview loading, then ready with the backend view', () async {
    final port = _port([_build, _deliver], held: {'getStockIssue'});
    final cubit = OrderStatusChangeCubit(port, _orderId);
    await _loaded(cubit, port);
    cubit.selectStep(kEventDelivered);
    expect(cubit.state.previewStatus, OrderStatusChangeStatus.loading);
    expect(cubit.state.stockIssue, isNull);
    final OrderStockIssueView view = _view(5);
    port.pendingOf('getStockIssue').complete(view);
    await pumpEventQueue();
    expect(cubit.state.previewStatus, OrderStatusChangeStatus.ready);
    expect(cubit.state.stockIssue, same(view));
    expect(port.argsOf('getStockIssue').single, [_orderId]);
    await cubit.close();
  });

  test('a failed preview ⇒ preview error; the step stays picked', () async {
    final port = _port([_build, _deliver], errors: {'getStockIssue': StateError('offline')});
    final cubit = OrderStatusChangeCubit(port, _orderId);
    await _loaded(cubit, port);
    cubit.selectStep(kEventDelivered);
    await pumpEventQueue();
    expect(cubit.state.previewStatus, OrderStatusChangeStatus.error);
    expect(cubit.state.selected, kEventDelivered);
    await cubit.close();
  });

  for (final (outcome, bool fails) in [('answers', false), ('fails', true)]) {
    test('another step picked while the Đã giao preview is pending, then it $outcome ⇒ dropped, the step stays clean',
        () async {
      final port = _port([_build, _deliver], held: {'getStockIssue'});
      final cubit = OrderStatusChangeCubit(port, _orderId);
      await _loaded(cubit, port);
      cubit.selectStep(kEventDelivered);
      cubit.selectStep('bat_dau_thi_cong');
      const clean = OrderStatusChangeState(status: OrderStatusChangeStatus.ready, steps: [_build, _deliver], selected: 'bat_dau_thi_cong');
      expect(cubit.state, clean);
      final reply = port.pendingOf('getStockIssue');
      fails ? reply.completeError(StateError('offline')) : reply.complete(_view(5));
      await pumpEventQueue();
      expect(cubit.state, clean);
      await cubit.close();
    });

    test('two previews, the first $outcome AFTER the second ⇒ only the second is shown', () async {
      final port = _port([_build, _deliver], held: {'getStockIssue'});
      final cubit = OrderStatusChangeCubit(port, _orderId);
      await _loaded(cubit, port);
      cubit.selectStep(kEventDelivered);
      final second = cubit.loadPreview();
      // Two DIFFERENT views: an identical late one would be dropped as a duplicate state.
      final OrderStockIssueView shown = _view(9);
      port.pendingOf('getStockIssue', 1).complete(shown);
      await second;
      final OrderStatusChangeState before = cubit.state;
      expect(before.stockIssue, same(shown));

      final reply = port.pendingOf('getStockIssue');
      fails ? reply.completeError(StateError('offline')) : reply.complete(_view(1));
      await pumpEventQueue();
      expect(cubit.state, before);
      await cubit.close();
    });

    test('two lifecycle reads, the first $outcome AFTER the second ⇒ only the second is shown', () async {
      final port = RecordingOrdersPort(held: {'getLifecycle'});
      final cubit = OrderStatusChangeCubit(port, _orderId);
      final first = cubit.load();
      final second = cubit.load();
      port.pendingOf('getLifecycle', 1).complete(_lifecycle([_build, _deliver]));
      await second;
      final OrderStatusChangeState before = cubit.state;
      expect(before.steps, [_build, _deliver]);

      final reply = port.pendingOf('getLifecycle');
      fails ? reply.completeError(StateError('offline')) : reply.complete(_lifecycle([_deliver]));
      await first;
      await pumpEventQueue();
      expect(cubit.state, before);
      expect(port.log, ['getLifecycle', 'getLifecycle']);
      await cubit.close();
    });
  }

  test('a failed lifecycle ⇒ error', () async {
    final port = RecordingOrdersPort(errors: {'getLifecycle': StateError('offline')});
    final cubit = OrderStatusChangeCubit(port, _orderId);
    await cubit.load();
    expect(cubit.state, const OrderStatusChangeState(status: OrderStatusChangeStatus.error));
    await cubit.close();
  });

  test('submit with nothing picked ⇒ no request, null', () async {
    final port = _port([_build, _deliver]);
    final cubit = OrderStatusChangeCubit(port, _orderId);
    await _loaded(cubit, port);
    expect(await cubit.submit([XFile('a.jpg')]), isNull);
    expect(port.log, ['getLifecycle']);
    await cubit.close();
  });

  test('submit accepted ⇒ the picked event and the photos in order go out; sending on then off; the new status back',
      () async {
    final port = _port([_build, _deliver], held: {'transition'});
    final cubit = OrderStatusChangeCubit(port, _orderId);
    await _loaded(cubit, port);
    cubit.selectStep('bat_dau_thi_cong');
    final files = [XFile('a.jpg'), XFile('b.jpg')];
    final sent = cubit.submit(files);
    expect(cubit.state.sending, isTrue);
    port.pendingOf('transition').complete(_done);
    expect(await sent, 'dagiao');
    expect(cubit.state.sending, isFalse);
    final List<Object?> call = port.argsOf('transition').single;
    expect(call[0], _orderId);
    expect(call[1], 'bat_dau_thi_cong');
    expect((call[2]! as List<XFile>).map((f) => f.path), ['a.jpg', 'b.jpg']);
    await cubit.close();
  });

  test('submit refused on Đã giao ⇒ the backend sentence, its row errors, and the preview read again', () async {
    final port = _port([_build, _deliver], errors: {'transition': _short});
    final cubit = OrderStatusChangeCubit(port, _orderId);
    await _loaded(cubit, port);
    cubit.selectStep(kEventDelivered);
    await pumpEventQueue();
    expect(await cubit.submit(const []), isNull);
    await pumpEventQueue();
    expect(cubit.state.sendError, 'Không đủ tồn kho.');
    expect(cubit.state.lineErrors, {1: 'Thiếu 3 tấm.'});
    expect(cubit.state.sending, isFalse);
    expect(cubit.state.selected, kEventDelivered);
    expect(port.log, ['getLifecycle', 'getStockIssue', 'transition', 'getStockIssue']);
    await cubit.close();
  });

  test('submit failing in transport on another step ⇒ the screen sentence, no row errors, no preview', () async {
    final port = _port([_build, _deliver], errors: {'transition': StateError('offline')});
    final cubit = OrderStatusChangeCubit(port, _orderId);
    await _loaded(cubit, port);
    cubit.selectStep('bat_dau_thi_cong');
    expect(await cubit.submit(const []), isNull);
    expect(cubit.state.sendError, 'Không chuyển được trạng thái.');
    expect(cubit.state.lineErrors, isEmpty);
    expect(port.log, ['getLifecycle', 'transition']);
    await cubit.close();
  });

  test('a new send clears the last refusal first; picking a step clears it too', () async {
    final port = _port([_build, _deliver], errors: {'transition': _short}, held: {'transition'});
    final cubit = OrderStatusChangeCubit(port, _orderId);
    await _loaded(cubit, port);
    cubit.selectStep(kEventDelivered);
    await pumpEventQueue();
    final first = cubit.submit(const []);
    port.pendingOf('transition').complete();
    await first;
    expect(cubit.state.sendError, isNotNull);
    cubit.submit(const []);
    expect((cubit.state.sendError, cubit.state.lineErrors), (null, const <int, String>{}));
    port.pendingOf('transition', 1).complete();
    await pumpEventQueue();
    cubit.selectStep('bat_dau_thi_cong');
    expect(cubit.state.sendError, isNull);
    expect(cubit.state.lineErrors, isEmpty);
    await cubit.close();
  });

  group('every emit keeps the fields it does not own', () {
    // Every field but `sending` off its default (the selectStep case seeds `sending: true`),
    // so dropping one from a copy is visible.
    final OrderStockIssueView seededView = _view(4, blocked: true);
    OrderStatusChangeState seeded() => OrderStatusChangeState(
          status: OrderStatusChangeStatus.ready,
          steps: const [_build, _deliver],
          selected: kEventDelivered,
          stockIssue: seededView,
          previewStatus: OrderStatusChangeStatus.ready,
          sendError: 'cũ',
          lineErrors: const {0: 'cũ'},
        );

    blocTest<OrderStatusChangeCubit, OrderStatusChangeState>(
      'load keeps steps, pick, preview and refusal through loading and error',
      build: () => OrderStatusChangeCubit(RecordingOrdersPort(errors: {'getLifecycle': StateError('offline')}), _orderId),
      seed: seeded,
      act: (cubit) => cubit.load(),
      expect: () => [
        _copy(seeded(), status: OrderStatusChangeStatus.loading),
        _copy(seeded(), status: OrderStatusChangeStatus.error),
      ],
    );

    blocTest<OrderStatusChangeCubit, OrderStatusChangeState>(
      'loadPreview keeps everything but the preview',
      build: () => OrderStatusChangeCubit(RecordingOrdersPort(errors: {'getStockIssue': StateError('offline')}), _orderId),
      seed: seeded,
      act: (cubit) => cubit.loadPreview(),
      expect: () => [
        _copy(seeded(), previewStatus: OrderStatusChangeStatus.loading),
        _copy(seeded(), previewStatus: OrderStatusChangeStatus.error),
      ],
    );

    final OrderStockIssueView fresh = _view(7);
    blocTest<OrderStatusChangeCubit, OrderStatusChangeState>(
      'a preview answer sets the view and keeps the rest',
      build: () {
        final port = RecordingOrdersPort(held: {'getStockIssue'});
        Future<void>.delayed(Duration.zero, () => port.pendingOf('getStockIssue').complete(fresh));
        return OrderStatusChangeCubit(port, _orderId);
      },
      seed: seeded,
      act: (cubit) => cubit.loadPreview(),
      expect: () => [
        _copy(seeded(), previewStatus: OrderStatusChangeStatus.loading),
        _copy(seeded(), stockIssue: fresh),
      ],
    );

    blocTest<OrderStatusChangeCubit, OrderStatusChangeState>(
      'a refused send keeps steps, pick and preview; only sending, refusal and row errors change',
      build: () => OrderStatusChangeCubit(RecordingOrdersPort(errors: {'transition': _short, 'getStockIssue': StateError('x')}), _orderId),
      seed: seeded,
      act: (cubit) => cubit.submit(const []),
      expect: () => [
        _copy(seeded(), sending: true, sendError: null, lineErrors: const {}),
        _copy(seeded(), sendError: 'Không đủ tồn kho.', lineErrors: const {1: 'Thiếu 3 tấm.'}),
        _copy(seeded(), 
            sendError: 'Không đủ tồn kho.', lineErrors: const {1: 'Thiếu 3 tấm.'}, previewStatus: OrderStatusChangeStatus.loading),
        _copy(seeded(), 
            sendError: 'Không đủ tồn kho.', lineErrors: const {1: 'Thiếu 3 tấm.'}, previewStatus: OrderStatusChangeStatus.error),
      ],
    );

    blocTest<OrderStatusChangeCubit, OrderStatusChangeState>(
      'an accepted send keeps everything but sending',
      build: () => OrderStatusChangeCubit(RecordingOrdersPort(answers: {'transition': _done}), _orderId),
      seed: () => _copy(seeded(), sendError: null, lineErrors: const {}),
      act: (cubit) => cubit.submit(const []),
      expect: () => [
        _copy(seeded(), sending: true, sendError: null, lineErrors: const {}),
        _copy(seeded(), sendError: null, lineErrors: const {}),
      ],
    );

    blocTest<OrderStatusChangeCubit, OrderStatusChangeState>(
      'picking a step keeps the phase, the steps and sending',
      build: () => OrderStatusChangeCubit(RecordingOrdersPort(), _orderId),
      seed: () => _copy(seeded(), sending: true),
      act: (cubit) => cubit.selectStep('bat_dau_thi_cong'),
      expect: () => [
        const OrderStatusChangeState(
            status: OrderStatusChangeStatus.ready, steps: [_build, _deliver], selected: 'bat_dau_thi_cong', sending: true),
      ],
    );
  });

  group('the port answering after close ⇒ no throw, no emit', () {
    for (final (outcome, Object? error) in [('answers', null), ('fails', StateError('offline'))]) {
      Future<void> afterClose(String method, Future<Object?> Function(OrderStatusChangeCubit) act,
          {RecordingOrdersPort? port, Object? Function()? answer}) async {
        final p = port ?? RecordingOrdersPort(held: {method});
        final cubit = OrderStatusChangeCubit(p, _orderId);
        final call = act(cubit);
        final states = <OrderStatusChangeState>[];
        final sub = cubit.stream.listen(states.add);
        await cubit.close();
        final reply = p.pendingOf(method);
        error == null ? reply.complete(answer?.call()) : reply.completeError(error);
        expect(await call, isNull);
        await pumpEventQueue();
        expect(states, isEmpty);
        await sub.cancel();
      }

      test('load: the port $outcome', () => afterClose('getLifecycle', (c) async => c.load(), answer: () => _lifecycle([_deliver])));

      test('loadPreview: the port $outcome', () => afterClose('getStockIssue', (c) async => c.loadPreview()));

      test('submit: the port $outcome ⇒ null', () async {
        final port = _port([_build], held: {'transition'});
        final cubit = OrderStatusChangeCubit(port, _orderId);
        await _loaded(cubit, port);
        final sent = cubit.submit(const []);
        final states = <OrderStatusChangeState>[];
        final sub = cubit.stream.listen(states.add);
        await cubit.close();
        final reply = port.pendingOf('transition');
        error == null ? reply.complete(_done) : reply.completeError(error);
        expect(await sent, isNull);
        expect(states, isEmpty);
        await sub.cancel();
      });
    }
  });
}
