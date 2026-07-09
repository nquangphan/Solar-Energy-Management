import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripComments } from './util/strip-comments';
import { stripToCode } from './util/strip-to-code';

/**
 * Source-guard AD-18 (mirror `no-manual-prisma-client.spec.ts` + `stripToCode`): mọi
 * hành động nghiệp vụ có hệ quả phải publish qua `EventBus` port DUY NHẤT — producer
 * KHÔNG gọi FCM/notification/audit trực tiếp. Guard chặn hai lối rẽ:
 *
 *  (a) `firebase-admin` chỉ được import TRONG `src/notifications/` (nơi Epic 9 lắp bộ gửi);
 *      không module nào khác chạm SDK push.
 *  (b) Định danh nội bộ (`NotificationDispatcher`, `AuditSubscriber`, `AuditService`,
 *      `InProcessEventBus`) chỉ được tham chiếu bên trong module sở hữu — module khác
 *      KHÔNG import/inject consumer hay implementation bus trực tiếp, phải đi qua
 *      `EventBus.publish`. `new InProcessEventBus()` ở producer tạo bus RỖNG (không
 *      subscriber) → event bay hơi im lặng; cấm ngay tại source.
 *
 * Port công khai (`EventBus`, `DomainEvent`, `EventSubscriber`) được phép import bất kỳ đâu.
 *
 * Check định danh quét trên `stripToCode` (bỏ CẢ comment lẫn string — comment/doc nhắc tên
 * class KHÔNG tính). Riêng check `firebase-admin` cần thấy import specifier (là string) nên
 * quét trên `stripComments` (bỏ comment, GIỮ string) với regex bám cú pháp import/require.
 */
describe('source-guard: side-effect chỉ qua EventBus port (AD-18)', () => {
  const SRC_DIR = resolve(__dirname, '../src');
  const NOTIFICATIONS_DIR = join(SRC_DIR, 'notifications');
  const AUDIT_DIR = join(SRC_DIR, 'audit');
  const EVENTS_DIR = join(SRC_DIR, 'events');

  /**
   * Mọi lối vào SDK: `from 'x'`, `require('x')`, bare `import 'x'`, dynamic `import('x')`,
   * `export … from 'x'`. Subpath `firebase-admin/messaging` là dạng CHÍNH TẮC của SDK v10+
   * — bỏ sót nó là guard rỗng ruột. `(?:\/[^'"]*)?` phủ subpath; `\(?` phủ dynamic import.
   * Quote phải đứng ngay trước `firebase-admin` nên `'my-firebase-admin-helper'` không dính.
   */
  const FIREBASE_IMPORT =
    /(?:\bfrom|\brequire\s*\(|\bimport)\s*\(?\s*['"]firebase-admin(?:\/[^'"]*)?['"]/;

  /** Định danh nội bộ → thư mục module sở hữu (nơi DUY NHẤT được tham chiếu nó). */
  const OWNED_IDENTIFIERS: ReadonlyArray<{ id: string; ownerDir: string }> = [
    { id: 'NotificationDispatcher', ownerDir: NOTIFICATIONS_DIR },
    { id: 'AuditSubscriber', ownerDir: AUDIT_DIR },
    { id: 'AuditService', ownerDir: AUDIT_DIR },
    { id: 'InProcessEventBus', ownerDir: EVENTS_DIR },
  ];

  function collectTsFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectTsFiles(full));
      } else if (entry.name.endsWith('.ts')) {
        files.push(full);
      }
    }
    return files;
  }

  const allFiles = collectTsFiles(SRC_DIR);

  it('guard thực sự quét src/ (không xanh giả vì danh sách file rỗng)', () => {
    expect(allFiles.length).toBeGreaterThan(0);
    // Mọi module sở hữu đều nằm trong tầm quét (nếu không, rule (b) trắng trơn).
    for (const { ownerDir } of OWNED_IDENTIFIERS) {
      expect(allFiles.some((f) => f.startsWith(ownerDir + '/'))).toBe(true);
    }
    // ...và có file NGOÀI mọi module sở hữu để rule (b) có gì để kiểm.
    expect(
      allFiles.some((f) =>
        OWNED_IDENTIFIERS.every(
          ({ ownerDir }) => !f.startsWith(ownerDir + '/'),
        ),
      ),
    ).toBe(true);
  });

  it('regex firebase-admin bắt MỌI dạng import (kể cả subpath + dynamic)', () => {
    const violations = [
      `import * as admin from 'firebase-admin';`,
      `import { initializeApp } from 'firebase-admin/app';`,
      `import { getMessaging } from 'firebase-admin/messaging';`,
      `const admin = require('firebase-admin');`,
      `const m = require('firebase-admin/messaging');`,
      `import 'firebase-admin';`,
      `await import('firebase-admin');`,
      `await import('firebase-admin/messaging');`,
      `export { getMessaging } from 'firebase-admin/messaging';`,
    ];
    for (const source of violations) {
      expect(FIREBASE_IMPORT.test(stripComments(source))).toBe(true);
    }
  });

  it('regex firebase-admin KHÔNG false-positive (comment, package tên gần giống)', () => {
    const benign = [
      `// từng cân nhắc from 'firebase-admin'\nconst x = 1;`,
      `import { helper } from 'my-firebase-admin-helper';`,
      `import { x } from 'firebase-administration';`,
    ];
    for (const source of benign) {
      expect(FIREBASE_IMPORT.test(stripComments(source))).toBe(false);
    }
  });

  it('check định danh bắt code thật, bỏ qua nhắc trong doc', () => {
    const consumerImport = `import { AuditService } from '../audit/audit.service';`;
    expect(/\bAuditService\b/.test(stripToCode(consumerImport))).toBe(true);
    const consumerInDoc = `/** producer KHÔNG inject AuditService trực tiếp */\nconst x = 1;`;
    expect(/\bAuditService\b/.test(stripToCode(consumerInDoc))).toBe(false);
    // `new InProcessEventBus()` ngoài events/ = bus rỗng, event bay hơi → phải bị bắt.
    const busBypass = `const bus = new InProcessEventBus();`;
    expect(/\bInProcessEventBus\b/.test(stripToCode(busBypass))).toBe(true);
  });

  it('`firebase-admin` CHƯA nằm trong dependencies (bộ gửi thật lắp ở Epic 9)', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(__dirname, '../package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(
      Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }),
    ).not.toContain('firebase-admin');
  });

  it('không import `firebase-admin` ngoài src/notifications/ (Epic 9 seam)', () => {
    const offenders = allFiles
      .filter((file) => !file.startsWith(NOTIFICATIONS_DIR + '/'))
      .filter((file) =>
        FIREBASE_IMPORT.test(stripComments(readFileSync(file, 'utf8'))),
      );
    expect(offenders).toEqual([]);
  });

  it('không tham chiếu consumer/implementation bus ngoài module sở hữu', () => {
    const offenders = allFiles.flatMap((file) => {
      const code = stripToCode(readFileSync(file, 'utf8'));
      return OWNED_IDENTIFIERS.filter(
        ({ id, ownerDir }) =>
          !file.startsWith(ownerDir + '/') &&
          new RegExp(`\\b${id}\\b`).test(code),
      ).map(({ id }) => `${file} → ${id}`);
    });
    expect(offenders).toEqual([]);
  });
});
