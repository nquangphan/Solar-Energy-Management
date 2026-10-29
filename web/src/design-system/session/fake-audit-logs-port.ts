// hand-authored — TEST/DEMO-ONLY fake port (Story 8.5, mirror Flutter
// mobile/lib/design_system/session/fake_audit_logs_port.dart).
//
// NOT a real backend: fixed records so the Audit screen renders without a
// network. It filters nothing and computes nothing; it records every query.

import type { AuditLogEntry, AuditLogPage, AuditLogQuery, AuditLogsPort } from './audit-logs-port';

/** Records covering the cases the screen must render: a system actor, no target, a status and a money change. */
export const DEMO_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    eventType: 'OrderConfirmed',
    eventLabel: 'Chốt đơn',
    actorAccountId: '11111111-1111-4111-8111-111111111111',
    actorDisplayName: 'Trần Kinh Doanh',
    targetType: 'Order',
    targetId: '9f8e7d6c-5b4a-4321-8765-0123456789ab',
    occurredAt: '2026-10-30T03:05:00.000Z',
    changes: [{ field: 'status', before: 'baogia', after: 'dachot', isMoney: false }],
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000002',
    eventType: 'PaymentRecorded',
    eventLabel: 'Ghi nhận thanh toán',
    actorAccountId: '22222222-2222-4222-8222-222222222222',
    actorDisplayName: 'Lê Kế Toán',
    targetType: 'Order',
    targetId: '9f8e7d6c-5b4a-4321-8765-0123456789ab',
    occurredAt: '2026-10-29T09:30:00.000Z',
    changes: [{ field: 'orderPaid', before: '0', after: '83010960', isMoney: true }],
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000003',
    eventType: 'StatusChanged',
    eventLabel: 'Chuyển trạng thái',
    actorAccountId: null,
    actorDisplayName: null,
    targetType: 'Order',
    targetId: '9f8e7d6c-5b4a-4321-8765-0123456789ab',
    occurredAt: '2026-10-29T09:30:00.000Z',
    changes: [{ field: 'status', before: 'dachot', after: 'dacoc', isMoney: false }],
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000004',
    eventType: 'PasswordChanged',
    eventLabel: 'Đổi mật khẩu',
    actorAccountId: '33333333-3333-4333-8333-333333333333',
    actorDisplayName: null,
    targetType: null,
    targetId: null,
    occurredAt: '2026-10-28T01:00:00.000Z',
    changes: [],
  },
];

export class FakeAuditLogsPort implements AuditLogsPort {
  readonly calls: AuditLogQuery[] = [];

  /** `total` is a fixed literal so the screen shows a second page. */
  constructor(
    private readonly page: AuditLogPage = {
      items: DEMO_AUDIT_LOGS,
      total: 45,
      page: 1,
      pageSize: 20,
    },
  ) {}

  listAuditLogs(query: AuditLogQuery): Promise<AuditLogPage> {
    this.calls.push(query);
    return Promise.resolve({ ...this.page, page: query.page ?? 1 });
  }
}
