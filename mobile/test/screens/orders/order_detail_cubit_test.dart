// OrderDetailCubit (Story 11.3): the order batch, the silent re-read, the Ảnh tab and the
// stock-out OrderDetailScreen used to hold in its State.
import 'dart:typed_data';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:pns_mobile/design_system/session/fake_orders_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/screens/orders/order_detail_cubit.dart';
import 'package:pns_mobile/screens/orders/order_detail_state.dart';

import 'recording_orders_port.dart';

const String _id = 'ord-1';
const List<String> _batch = ['get', 'getLifecycle', 'listVersions'];

late Order _orderA;
late Order _orderB;
late List<OrderVersionItem> _versionsA;

OrderLifecycle _lifecycle({bool canCancel = false, List<OrderNextStep> next = const []}) => OrderLifecycle(
      steps: const [OrderLifecycleStep(status: OrderLifecycleStepDtoStatus.baogia, progress: OrderLifecycleStepDtoProgress.current)],
      nextSteps: next,
      canCancel: canCancel,
    );

const OrderNextStep _step = OrderNextStep(event: 'chot', to: OrderNextStepDtoTo.dachot, requires: 'x');

AttachmentItem _photo(String id) => AttachmentItem(
      id: id,
      fileName: '$id.jpg',
      contentType: 'image/jpeg',
      size: 10,
      createdAt: DateTime.utc(2026, 10, 23),
      uploadedBy: 'A',
      canDelete: true,
    );

OrderStockIssueView _view(bool canIssue) =>
    OrderStockIssueView(issued: false, canIssue: canIssue, blocked: false, lines: const [], untrackedItems: const []);

Uint8List _bytes(int b) => Uint8List.fromList([b]);

/// A port that answers the batch with [_orderA], the photos with p1/p2 and each
/// photo's bytes with its own byte, unless [held] / [errors] say otherwise.
RecordingOrdersPort _port({Set<String>? held, Map<String, Object>? errors}) => RecordingOrdersPort(
      held: held,
      errors: errors,
      answers: {
        'get': _orderA,
        'getLifecycle': _lifecycle(canCancel: true, next: const [_step]),
        'listVersions': const <OrderVersionItem>[],
        'listAttachments': [_photo('p1'), _photo('p2')],
        'getStockIssue': _view(true),
        'attachmentBytes': _bytes(1),
        'addAttachments': true,
        'removeAttachment': true,
      },
    );

OrderDetailCubit _cubit(RecordingOrdersPort port, {bool loadsStockIssue = false}) =>
    OrderDetailCubit(port, _id, loadsStockIssue: loadsStockIssue);

/// Answers the [n]-th held batch with [order], or fails all three with [error].
void _answerBatch(RecordingOrdersPort port, int n, {Order? order, bool canCancel = false, Object? error}) {
  if (error != null) {
    for (final m in _batch) {
      port.pendingOf(m, n).completeError(error);
    }
    return;
  }
  port.pendingOf('get', n).complete(order);
  port.pendingOf('getLifecycle', n).complete(_lifecycle(canCancel: canCancel));
  port.pendingOf('listVersions', n).complete(const <OrderVersionItem>[]);
}

/// The byte answers of the photos on screen, by id.
Map<String, List<int>> _shownBytes(OrderDetailCubit cubit) =>
    {for (final e in cubit.state.photoBytes.entries) e.key: e.value.toList()};

/// [s] with some fields replaced — built field by field, independent of the
/// production copyWith, so an expectation cannot share its carry-over bug.
const Object _same = Object();
OrderDetailState _copy(
  OrderDetailState s, {
  OrderDetailStatus? status,
  Object? stockIssue = _same,
  OrderDetailStatus? photosStatus,
  Map<String, Uint8List>? photoBytes,
}) =>
    OrderDetailState(
      status: status ?? s.status,
      order: s.order,
      steps: s.steps,
      nextSteps: s.nextSteps,
      canCancel: s.canCancel,
      versions: s.versions,
      stockIssue: identical(stockIssue, _same) ? s.stockIssue : stockIssue as OrderStockIssueView?,
      photosStatus: photosStatus ?? s.photosStatus,
      photos: s.photos,
      photoBytes: photoBytes ?? s.photoBytes,
    );

void main() {
  setUpAll(() async {
    final fake = FakeOrdersPort();
    _orderA = await fake.create(const CreateOrderInput(customerPhone: '0903176968'));
    _orderB = await fake.create(const CreateOrderInput(customerPhone: '0912345678'));
    _versionsA = await fake.listVersions(_orderA.id);
    expect(_versionsA, isNotEmpty);
  });

  test('starts loading, no order, the Ảnh tab not loaded', () {
    final cubit = _cubit(RecordingOrdersPort());
    expect(cubit.state, const OrderDetailState());
    cubit.close();
  });

  test('load asks for the order, lifecycle and history as ONE batch, then shows them', () async {
    final port = _port(held: _batch.toSet());
    final cubit = _cubit(port);
    final load = cubit.load();
    // All three are in flight before any answer: Future.wait, not one after the other.
    expect(port.log, _batch);
    expect(port.args.every((a) => a.single == _id), isTrue);
    expect(cubit.state.status, OrderDetailStatus.loading);
    _answerBatch(port, 0, order: _orderA, canCancel: true);
    await load;
    expect(cubit.state.status, OrderDetailStatus.ready);
    expect(cubit.state.order, same(_orderA));
    expect(cubit.state.canCancel, isTrue);
    expect(cubit.state.steps.single.status, OrderLifecycleStepDtoStatus.baogia);
    await cubit.close();
  });

  for (final (String what, Object error, OrderDetailStatus status) in [
    ('NOT_FOUND', const OrderPortException('Không tìm thấy đơn.', code: 'NOT_FOUND'), OrderDetailStatus.notFound),
    ('another code', const OrderPortException('Bị cấm.', code: 'FORBIDDEN'), OrderDetailStatus.error),
    ('a transport failure', StateError('offline'), OrderDetailStatus.error),
  ]) {
    blocTest<OrderDetailCubit, OrderDetailState>(
      'load failing with $what ⇒ $status',
      build: () => _cubit(_port(errors: {'getLifecycle': error})),
      act: (cubit) => cubit.load(),
      expect: () => [const OrderDetailState(), OrderDetailState(status: status)],
    );
  }

  group('the silent re-read when a pushed screen closes', () {
    test('a failure keeps the order, steps and versions on screen — no loading, no error', () async {
      final port = _port();
      final cubit = _cubit(port);
      await cubit.load();
      final OrderDetailState shown = cubit.state;
      expect(shown.status, OrderDetailStatus.ready);

      final states = <OrderDetailState>[];
      final sub = cubit.stream.listen(states.add);
      port.errors['listVersions'] = StateError('offline');
      cubit.reloadAfterReturn();
      await pumpEventQueue();
      expect(states, isEmpty);
      expect(cubit.state, shown);
      await sub.cancel();
      await cubit.close();
    });

    test('a success shows the fresh order without passing through loading', () async {
      final port = _port();
      final cubit = _cubit(port);
      await cubit.load();
      final states = <OrderDetailState>[];
      final sub = cubit.stream.listen(states.add);
      port.answers['get'] = _orderB;
      cubit.reloadAfterReturn();
      await pumpEventQueue();
      expect(states.map((s) => s.status), [OrderDetailStatus.ready]);
      expect(cubit.state.order, same(_orderB));
      await sub.cancel();
      await cubit.close();
    });

    test('when the first read had failed, the re-read shows the skeleton again', () async {
      final port = _port(errors: {'get': StateError('offline')});
      final cubit = _cubit(port);
      await cubit.load();
      expect(cubit.state.status, OrderDetailStatus.error);
      final states = <OrderDetailState>[];
      final sub = cubit.stream.listen(states.add);
      port.errors.clear();
      cubit.reloadAfterReturn();
      await pumpEventQueue();
      expect(states.map((s) => s.status), [OrderDetailStatus.loading, OrderDetailStatus.ready]);
      await sub.cancel();
      await cubit.close();
    });

    for (final bool loadsStockIssue in [true, false]) {
      test('reads the stock-out again only when the caller may read it ($loadsStockIssue)', () async {
        final port = _port();
        final cubit = _cubit(port, loadsStockIssue: loadsStockIssue);
        await cubit.load();
        port.log.clear();
        cubit.reloadAfterReturn();
        await pumpEventQueue();
        expect(port.log.contains('getStockIssue'), loadsStockIssue);
        await cubit.close();
      });
    }

    test('reads the photos again only once the Ảnh tab was opened', () async {
      final port = _port();
      final cubit = _cubit(port);
      await cubit.load();
      cubit.reloadAfterReturn();
      await pumpEventQueue();
      expect(port.log.where((m) => m == 'listAttachments'), isEmpty);

      cubit.openPhotos();
      await pumpEventQueue();
      cubit.reloadAfterReturn();
      await pumpEventQueue();
      expect(port.log.where((m) => m == 'listAttachments').length, 2);
      await cubit.close();
    });
  });

  group('the Ảnh tab', () {
    test('opening it twice loads it once', () async {
      final port = _port();
      final cubit = _cubit(port);
      cubit.openPhotos();
      cubit.openPhotos();
      await pumpEventQueue();
      expect(port.log, ['listAttachments', 'attachmentBytes', 'attachmentBytes']);
      expect(cubit.state.photosStatus, OrderDetailStatus.ready);
      await cubit.close();
    });

    test('bytes are fetched one photo at a time, in list order; a failed one leaves the others', () async {
      final port = _port(held: {'attachmentBytes'})..answers['listAttachments'] = [_photo('p1'), _photo('p2'), _photo('p3')];
      final cubit = _cubit(port);
      final load = cubit.loadPhotos();
      await pumpEventQueue();
      expect(port.argsOf('attachmentBytes'), [
        [_id, 'p1'],
      ]);
      port.pendingOf('attachmentBytes').complete(_bytes(1));
      await pumpEventQueue();
      expect(port.argsOf('attachmentBytes').length, 2);
      port.pendingOf('attachmentBytes', 1).completeError(StateError('broken'));
      await pumpEventQueue();
      port.pendingOf('attachmentBytes', 2).complete(_bytes(3));
      await load;
      expect(_shownBytes(cubit), {
        'p1': [1],
        'p3': [3],
      });
      expect(cubit.state.photosStatus, OrderDetailStatus.ready);
      await cubit.close();
    });

    test('a reload drops the old bytes at its very first emit', () async {
      final port = _port(held: {'listAttachments'});
      final cubit = _cubit(port);
      final first = cubit.loadPhotos();
      port.pendingOf('listAttachments').complete();
      await first;
      expect(cubit.state.photoBytes, isNotEmpty);
      cubit.loadPhotos();
      expect(cubit.state.photosStatus, OrderDetailStatus.loading);
      expect(cubit.state.photoBytes, isEmpty);
      expect(cubit.state.photos.length, 2);
      port.pendingOf('listAttachments', 1).complete();
      await pumpEventQueue();
      await cubit.close();
    });

    test('a failed list ⇒ photos error', () async {
      final cubit = _cubit(_port(errors: {'listAttachments': StateError('offline')}));
      await cubit.loadPhotos();
      expect(cubit.state.photosStatus, OrderDetailStatus.error);
      await cubit.close();
    });

    test('addPhotos sends the files, reloads the tab and answers true', () async {
      final port = _port();
      final cubit = _cubit(port);
      final files = [XFile('a.jpg')];
      expect(await cubit.addPhotos(files), isTrue);
      expect(port.argsOf('addAttachments').single, [_id, files]);
      expect(port.log.first, 'addAttachments');
      expect(port.log.contains('listAttachments'), isTrue);
      await pumpEventQueue();
      await cubit.close();
    });

    test('addPhotos refused ⇒ photos error, false, no reload', () async {
      final port = _port(errors: {'addAttachments': StateError('too big')});
      final cubit = _cubit(port);
      expect(await cubit.addPhotos([XFile('a.jpg')]), isFalse);
      expect(cubit.state.photosStatus, OrderDetailStatus.error);
      expect(port.log, ['addAttachments']);
      await cubit.close();
    });

    test('removePhoto deletes that photo, then reloads the tab', () async {
      final port = _port();
      final cubit = _cubit(port);
      await cubit.removePhoto('p2');
      expect(port.log.take(2), ['removeAttachment', 'listAttachments']);
      expect(port.argsOf('removeAttachment').single, [_id, 'p2']);
      await cubit.close();
    });

    test('removePhoto refused ⇒ photos error, no reload', () async {
      final port = _port(errors: {'removeAttachment': StateError('403')});
      final cubit = _cubit(port);
      await cubit.removePhoto('p2');
      expect(cubit.state.photosStatus, OrderDetailStatus.error);
      expect(port.log, ['removeAttachment']);
      await cubit.close();
    });
  });

  group('the stock-out', () {
    test('loadStockIssue shows the view; a failure removes the frame (null), no error', () async {
      final port = _port();
      final cubit = _cubit(port);
      await cubit.loadStockIssue();
      expect(cubit.state.stockIssue?.canIssue, isTrue);
      port.errors['getStockIssue'] = StateError('offline');
      await cubit.loadStockIssue();
      expect(cubit.state.stockIssue, isNull);
      expect(cubit.state.status, OrderDetailStatus.loading);
      await cubit.close();
    });

    test('the sheet: issueStock and cancel hand the port error back untouched; its re-read fails to null', () async {
      const refused = OrderPortException('Không đủ tồn.', code: 'CONFLICT');
      final port = _port(errors: {'issueStock': refused, 'cancel': refused, 'getStockIssue': refused});
      final cubit = _cubit(port);
      await expectLater(cubit.issueStock(), throwsA(same(refused)));
      await expectLater(cubit.cancel('  khách đổi ý '), throwsA(same(refused)));
      expect(await cubit.stockIssueForSheet(), isNull);
      expect(port.argsOf('cancel').single, [_id, '  khách đổi ý ']);
      expect(cubit.state, const OrderDetailState());
      await cubit.close();
    });

    test('the sheet re-read answers the backend view', () async {
      final cubit = _cubit(_port());
      expect((await cubit.stockIssueForSheet())?.canIssue, isTrue);
      await cubit.close();
    });
  });

  group('answers arriving out of order — only the newest is shown', () {
    for (final (outcome, Object? lateError) in [('answers', null), ('fails', StateError('offline'))]) {
      test('the order batch: the first $outcome AFTER the second', () async {
        final port = _port(held: _batch.toSet());
        final cubit = _cubit(port);
        final first = cubit.load();
        final second = cubit.load();
        _answerBatch(port, 1, order: _orderB, canCancel: true);
        await second;
        final OrderDetailState shown = cubit.state;
        expect(shown.order, same(_orderB));

        final states = <OrderDetailState>[];
        final sub = cubit.stream.listen(states.add);
        _answerBatch(port, 0, order: _orderA, error: lateError);
        await first;
        await pumpEventQueue();
        expect(states, isEmpty);
        expect(cubit.state, shown);
        await sub.cancel();
        await cubit.close();
      });

      test('the photo list: the first $outcome AFTER the second', () async {
        final port = _port(held: {'listAttachments', 'attachmentBytes'});
        final cubit = _cubit(port);
        final first = cubit.loadPhotos();
        final second = cubit.loadPhotos();
        port.pendingOf('listAttachments', 1).complete([_photo('p9')]);
        await pumpEventQueue();
        port.pendingOf('attachmentBytes').complete(_bytes(9));
        await second;
        final OrderDetailState shown = cubit.state;
        expect(shown.photos.single.id, 'p9');

        final states = <OrderDetailState>[];
        final sub = cubit.stream.listen(states.add);
        final reply = port.pendingOf('listAttachments');
        lateError == null ? reply.complete([_photo('p1')]) : reply.completeError(lateError);
        await first;
        await pumpEventQueue();
        expect(states, isEmpty);
        expect(cubit.state, shown);
        expect(port.argsOf('attachmentBytes').length, 1);
        await sub.cancel();
        await cubit.close();
      });

      test('the stock-out: the first $outcome AFTER the second', () async {
        final port = _port(held: {'getStockIssue'});
        final cubit = _cubit(port);
        final first = cubit.loadStockIssue();
        final second = cubit.loadStockIssue();
        final OrderStockIssueView fresh = _view(false);
        port.pendingOf('getStockIssue', 1).complete(fresh);
        await second;
        expect(cubit.state.stockIssue, same(fresh));

        final reply = port.pendingOf('getStockIssue');
        lateError == null ? reply.complete(_view(true)) : reply.completeError(lateError);
        await first;
        expect(cubit.state.stockIssue, same(fresh));
        await cubit.close();
      });
    }

    test("a photo's late bytes from a superseded load are dropped", () async {
      final port = _port(held: {'attachmentBytes'});
      final cubit = _cubit(port);
      final first = cubit.loadPhotos();
      await pumpEventQueue();
      final second = cubit.loadPhotos();
      await pumpEventQueue();
      port.pendingOf('attachmentBytes').complete(_bytes(7));
      await first;
      expect(cubit.state.photoBytes, isEmpty);
      port.pendingOf('attachmentBytes', 1).complete(_bytes(1));
      await pumpEventQueue();
      port.pendingOf('attachmentBytes', 2).complete(_bytes(2));
      await second;
      expect(_shownBytes(cubit), {
        'p1': [1],
        'p2': [2],
      });
      await cubit.close();
    });
  });

  group('every emit keeps the fields it does not own', () {
    // Every field off its default, so dropping one from a copy is visible.
    final OrderStockIssueView seededView = _view(false);
    final List<AttachmentItem> seededPhotos = [_photo('s1')];
    final Map<String, Uint8List> seededBytes = {'s1': _bytes(5)};
    late OrderDetailState seeded;
    setUp(() => seeded = OrderDetailState(
          status: OrderDetailStatus.ready,
          order: _orderA,
          steps: _lifecycle().steps,
          nextSteps: const [_step],
          canCancel: true,
          versions: _versionsA,
          stockIssue: seededView,
          photosStatus: OrderDetailStatus.ready,
          photos: seededPhotos,
          photoBytes: seededBytes,
        ));

    blocTest<OrderDetailCubit, OrderDetailState>(
      'load keeps everything but the phase, through loading and error',
      build: () => _cubit(_port(errors: {'get': StateError('offline')})),
      seed: () => seeded,
      act: (cubit) => cubit.load(),
      expect: () => [_copy(seeded, status: OrderDetailStatus.loading), _copy(seeded, status: OrderDetailStatus.error)],
    );

    blocTest<OrderDetailCubit, OrderDetailState>(
      'a loaded batch keeps the stock-out and the photos',
      build: () => _cubit(_port()..answers['get'] = _orderB),
      seed: () => seeded,
      act: (cubit) => cubit.load(),
      expect: () => [
        _copy(seeded, status: OrderDetailStatus.loading),
        isA<OrderDetailState>()
            .having((s) => s.order, 'order', same(_orderB))
            .having((s) => s.nextSteps, 'nextSteps', [_step])
            .having((s) => (s.stockIssue, s.photos, s.photoBytes, s.photosStatus), 'the rest',
                (seededView, seededPhotos, seededBytes, OrderDetailStatus.ready)),
      ],
    );

    blocTest<OrderDetailCubit, OrderDetailState>(
      'loadStockIssue failing keeps everything but the stock-out',
      build: () => _cubit(_port(errors: {'getStockIssue': StateError('offline')})),
      seed: () => seeded,
      act: (cubit) => cubit.loadStockIssue(),
      expect: () => [_copy(seeded, stockIssue: null)],
    );

    blocTest<OrderDetailCubit, OrderDetailState>(
      'loadPhotos failing keeps the order panel and the stock-out',
      build: () => _cubit(_port(errors: {'listAttachments': StateError('offline')})),
      seed: () => seeded,
      act: (cubit) => cubit.loadPhotos(),
      expect: () => [
        _copy(seeded, photosStatus: OrderDetailStatus.loading, photoBytes: const {}),
        _copy(seeded, photosStatus: OrderDetailStatus.error, photoBytes: const {}),
      ],
    );

    blocTest<OrderDetailCubit, OrderDetailState>(
      'addPhotos refused keeps everything but the photo phase',
      build: () => _cubit(_port(errors: {'addAttachments': StateError('x')})),
      seed: () => seeded,
      act: (cubit) => cubit.addPhotos(const []),
      expect: () => [_copy(seeded, photosStatus: OrderDetailStatus.error)],
    );
  });

  group('the port answering after close ⇒ no throw, no emit', () {
    for (final (outcome, Object? error) in [('answers', null), ('fails', StateError('offline'))]) {
      Future<void> afterClose(Set<String> held, Future<void> Function(OrderDetailCubit) act) async {
        final port = _port(held: held);
        final cubit = _cubit(port);
        final call = act(cubit);
        final states = <OrderDetailState>[];
        final sub = cubit.stream.listen(states.add);
        await cubit.close();
        for (final m in held) {
          final reply = port.pendingOf(m);
          error == null ? reply.complete() : reply.completeError(error);
        }
        await call;
        await pumpEventQueue();
        expect(states, isEmpty);
        await sub.cancel();
      }

      test('load: the port $outcome', () => afterClose(_batch.toSet(), (c) => c.load()));
      test('loadPhotos: the list $outcome', () => afterClose({'listAttachments'}, (c) => c.loadPhotos()));
      test('loadPhotos: a photo\'s bytes $outcome', () async {
        final port = _port(held: {'attachmentBytes'});
        final cubit = _cubit(port);
        final call = cubit.loadPhotos();
        await pumpEventQueue();
        final states = <OrderDetailState>[];
        final sub = cubit.stream.listen(states.add);
        await cubit.close();
        final reply = port.pendingOf('attachmentBytes');
        error == null ? reply.complete(_bytes(1)) : reply.completeError(error);
        if (error != null) {
          // A failed photo moves on to the next one, closed or not — as the screen did.
          await pumpEventQueue();
          port.pendingOf('attachmentBytes', 1).complete(_bytes(2));
        }
        await call;
        expect(states, isEmpty);
        expect(port.argsOf('attachmentBytes').length, error == null ? 1 : 2);
        await sub.cancel();
      });
      test('loadStockIssue: the port $outcome', () => afterClose({'getStockIssue'}, (c) => c.loadStockIssue()));
      test('addPhotos: the port $outcome ⇒ false, no reload', () async {
        final port = _port(held: {'addAttachments'});
        final cubit = _cubit(port);
        final call = cubit.addPhotos(const []);
        await cubit.close();
        final reply = port.pendingOf('addAttachments');
        error == null ? reply.complete() : reply.completeError(error);
        expect(await call, isFalse);
        expect(port.log, ['addAttachments']);
      });
      test('removePhoto: the port $outcome ⇒ no reload', () async {
        final port = _port(held: {'removeAttachment'});
        final cubit = _cubit(port);
        final call = cubit.removePhoto('p1');
        await cubit.close();
        final reply = port.pendingOf('removeAttachment');
        error == null ? reply.complete() : reply.completeError(error);
        await call;
        expect(port.log, ['removeAttachment']);
      });
    }
  });
}
