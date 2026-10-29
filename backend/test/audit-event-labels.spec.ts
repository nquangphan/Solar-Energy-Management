import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  AUDIT_EVENT_LABELS,
  auditEventLabel,
} from '../src/audit/domain/audit-event-labels';
import { AUDIT_TARGET_TYPES } from '../src/audit/domain/audit-target-types';
import { stripComments } from './util/strip-comments';

/**
 * The audit screen labels every event type and filters on every target type. Both lists are
 * read off the event SOURCES (`src/**\/domain/*.ts`) so a new event or target cannot ship
 * without a label or a filter entry.
 */
describe('audit event labels and target types', () => {
  const SRC_DIR = resolve(__dirname, '../src');

  function domainFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) files.push(...domainFiles(full));
      else if (
        entry.name.endsWith('.ts') &&
        full.split('/').slice(-2, -1)[0] === 'domain'
      )
        files.push(full);
    }
    return files;
  }

  const sources = domainFiles(SRC_DIR).map((f) =>
    stripComments(readFileSync(f, 'utf8')),
  );

  function matches(pattern: RegExp): Set<string> {
    const found = new Set<string>();
    for (const source of sources)
      for (const m of source.matchAll(pattern)) found.add(m[1]);
    return found;
  }

  const eventTypes = matches(/readonly type = '([A-Za-z]+)'/g);
  const targetTypes = new Set([
    ...matches(/target = \{ type: '([A-Za-z]+)'/g),
    ...matches(/type: '([A-Za-z]+)', id\b/g),
  ]);

  it('scans the real event sources (not blind)', () => {
    expect(eventTypes.size).toBeGreaterThanOrEqual(47);
    expect(targetTypes.size).toBeGreaterThanOrEqual(9);
  });

  it('every published event type has a label', () => {
    const missing = [...eventTypes].filter(
      (type) => !Object.hasOwn(AUDIT_EVENT_LABELS, type),
    );
    expect(missing).toEqual([]);
  });

  it('labels no event type that is not published', () => {
    const stale = Object.keys(AUDIT_EVENT_LABELS).filter(
      (type) => !eventTypes.has(type),
    );
    expect(stale).toEqual([]);
  });

  it('every label is a non-empty Vietnamese string distinct from its key', () => {
    for (const [type, label] of Object.entries(AUDIT_EVENT_LABELS)) {
      expect(label.trim()).not.toBe('');
      expect(label).not.toBe(type);
    }
  });

  it('auditEventLabel falls back to the type itself when unknown', () => {
    expect(auditEventLabel('OrderConfirmed')).toBe('Chốt đơn');
    expect(auditEventLabel('SomethingFromTheFuture')).toBe(
      'SomethingFromTheFuture',
    );
    expect(auditEventLabel('toString')).toBe('toString');
  });

  it('AUDIT_TARGET_TYPES equals the set of published target types', () => {
    expect([...targetTypes].sort()).toEqual([...AUDIT_TARGET_TYPES].sort());
  });
});
