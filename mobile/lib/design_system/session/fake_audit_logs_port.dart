// hand-authored — TEST/DEMO-ONLY fake port (Story 8.5, mirror web
// web/src/design-system/session/fake-audit-logs-port.ts).
//
// NOT a real backend: fixed records so the Audit screen renders without a
// network. It filters nothing and computes nothing; it records every query.
import '../../api/generated/models/audit_change_dto.dart';
import 'audit_logs_port.dart';

/// Records covering what the screen must render: a system actor, no target, a status and a money change.
final List<AuditLogEntry> kDemoAuditLogs = <AuditLogEntry>[
  AuditLogEntry(
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    eventType: 'OrderConfirmed',
    eventLabel: 'Chốt đơn',
    actorAccountId: '11111111-1111-4111-8111-111111111111',
    actorDisplayName: 'Trần Kinh Doanh',
    targetType: AuditTargetType.order,
    targetId: '9f8e7d6c-5b4a-4321-8765-0123456789ab',
    occurredAt: DateTime.utc(2026, 10, 30, 3, 5),
    changes: const <AuditChangeDto>[
      AuditChangeDto(
        field: 'status',
        before: 'baogia',
        after: 'dachot',
        isMoney: false,
      ),
    ],
  ),
  AuditLogEntry(
    id: 'a1b2c3d4-0000-4000-8000-000000000002',
    eventType: 'PaymentRecorded',
    eventLabel: 'Ghi nhận thanh toán',
    actorAccountId: '22222222-2222-4222-8222-222222222222',
    actorDisplayName: 'Lê Kế Toán',
    targetType: AuditTargetType.order,
    targetId: '9f8e7d6c-5b4a-4321-8765-0123456789ab',
    occurredAt: DateTime.utc(2026, 10, 29, 9, 30),
    changes: const <AuditChangeDto>[
      AuditChangeDto(
        field: 'orderPaid',
        before: '0',
        after: '83010960',
        isMoney: true,
      ),
    ],
  ),
  AuditLogEntry(
    id: 'a1b2c3d4-0000-4000-8000-000000000003',
    eventType: 'StatusChanged',
    eventLabel: 'Chuyển trạng thái',
    actorAccountId: null,
    actorDisplayName: null,
    targetType: AuditTargetType.order,
    targetId: '9f8e7d6c-5b4a-4321-8765-0123456789ab',
    occurredAt: DateTime.utc(2026, 10, 29, 9, 30),
    changes: const <AuditChangeDto>[
      AuditChangeDto(
        field: 'status',
        before: 'dachot',
        after: 'dacoc',
        isMoney: false,
      ),
    ],
  ),
  AuditLogEntry(
    id: 'a1b2c3d4-0000-4000-8000-000000000004',
    eventType: 'PasswordChanged',
    eventLabel: 'Đổi mật khẩu',
    actorAccountId: '33333333-3333-4333-8333-333333333333',
    actorDisplayName: null,
    targetType: null,
    targetId: null,
    occurredAt: DateTime.utc(2026, 10, 28, 1),
    changes: const <AuditChangeDto>[],
  ),
];

/// One query as the fake received it.
typedef AuditLogQuery = ({
  AuditTargetType? targetType,
  String? from,
  String? to,
  int? page,
});

class FakeAuditLogsPort implements AuditLogsPort {
  /// [total] is a fixed literal so the screen shows a second page.
  FakeAuditLogsPort({List<AuditLogEntry>? items, this.total = 45})
    : items = items ?? kDemoAuditLogs;

  final List<AuditLogEntry> items;
  final int total;
  final List<AuditLogQuery> calls = <AuditLogQuery>[];

  @override
  Future<AuditLogPage> listAuditLogs({
    AuditTargetType? targetType,
    String? from,
    String? to,
    int? page,
  }) async {
    calls.add((targetType: targetType, from: from, to: to, page: page));
    return AuditLogPage(
      items: items,
      total: total,
      page: page ?? 1,
      pageSize: 20,
    );
  }
}
