// HttpContractsPort (Story 10.8): overview, generate and the PDF download over the
// real transport. The download has no header to name it, so the name is the
// contract's stored `fileName` + `.pdf` (read from the overview first), falling
// back to the contract id; bytes survive a 401 replay.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/http_contracts_port.dart';
import 'package:pns_mobile/design_system/session/contracts_port.dart';

import 'support/api_stack.dart';
import 'support/contract_json.dart';
import 'support/fake_http.dart';

Future<(ApiStack, HttpContractsPort)> _port(FakeHandler handler) async {
  final s = await ApiStack(handler).signedIn();
  return (s, HttpContractsPort(s.client, s.transport));
}

void main() {
  test('getOverview and generateContract', () async {
    final (s, port) = await _port(
      routes({
        'GET /orders/o1/contracts': () => jsonBody(200, contractsOverviewJson()),
        'POST /orders/o1/contracts': () => jsonBody(201, contractJson(id: 'c2')),
      }),
    );
    final overview = await port.getOverview('o1');
    expect(overview.contractType, ContractsOverviewResponseDtoContractType.sale);
    expect(overview.orderTotal, 83010960);
    final created = await port.generateContract('o1');
    expect(created.id, 'c2');
    expect(created.createdAt, DateTime.utc(2026, 10, 22, 3));
    expect(s.adapter.requests, hasLength(2));
  });

  test('downloadContractPdf: overview, then the bytes, named <fileName>.pdf', () async {
    final (s, port) = await _port(
      routes({
        'GET /orders/o1/contracts': () => jsonBody(200, contractsOverviewJson()),
        'GET /orders/o1/contracts/c1/pdf': () => bytesBody(200, [0x25, 0x50, 0x44, 0x46]),
      }),
    );
    final file = await port.downloadContractPdf('o1', 'c1');
    expect(s.adapter.requests.map((r) => '${r.method} ${r.path}').toList(), [
      'GET /orders/o1/contracts',
      'GET /orders/o1/contracts/c1/pdf',
    ]);
    expect(file.fileName, 'hop-dong-mua-ban-7.pdf');
    expect(file.bytes, [0x25, 0x50, 0x44, 0x46]);
  });

  test('a contract missing from the overview falls back to <contractId>.pdf', () async {
    final (_, port) = await _port(
      routes({
        'GET /orders/o1/contracts': () => jsonBody(200, contractsOverviewJson(contracts: [])),
        'GET /orders/o1/contracts/c9/pdf': () => bytesBody(200, [1]),
      }),
    );
    expect((await port.downloadContractPdf('o1', 'c9')).fileName, 'c9.pdf');
  });

  test('the bytes come through a 401 on the download itself → refresh → replay', () async {
    final (s, port) = await _port(
      renewingOnce(
        routes({
          'GET /orders/o1/contracts': () => jsonBody(200, contractsOverviewJson()),
          'GET /orders/o1/contracts/c1/pdf': () => bytesBody(200, [7, 7]),
        }),
        onlyPath: '/orders/o1/contracts/c1/pdf',
      ),
    );
    expect((await port.downloadContractPdf('o1', 'c1')).bytes, [7, 7]);
    expect(s.adapter.to('/auth/refresh'), hasLength(1));
    expect(s.adapter.to('/orders/o1/contracts/c1/pdf'), hasLength(2), reason: 'refused once, replayed once');
  });

  test('a 404 envelope on the download is a ContractsPortError with the message', () async {
    final (_, port) = await _port(
      routes({
        'GET /orders/o1/contracts': () => jsonBody(200, contractsOverviewJson()),
        'GET /orders/o1/contracts/c1/pdf': () => jsonBody(404, envelope('NOT_FOUND', 'Không tìm thấy hợp đồng.')),
      }),
    );
    await expectLater(
      port.downloadContractPdf('o1', 'c1'),
      throwsA(
        isA<ContractsPortError>()
            .having((e) => e.status, 'status', 404)
            .having((e) => e.message, 'message', 'Không tìm thấy hợp đồng.'),
      ),
    );
  });
}
