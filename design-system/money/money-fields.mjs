// The ONE list of money-valued field names the money-render guard watches.
//
// Derived from the backend contract (backend/openapi/openapi.json): every numeric
// schema property whose description says it is an amount in "đồng" (the backend
// documents each money field as "số nguyên ĐỒNG" / "integer đồng"). A new money
// field documented that way is picked up with no edit here.
//
// EXTRA_MONEY_FIELDS covers money fields whose OpenAPI description does not say
// "đồng" (it describes the meaning instead) — each one is checked below to still
// exist in the contract, so this list cannot rot silently.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, '..', '..');
const openapiPath = resolve(repoRoot, 'backend/openapi/openapi.json');

const MONEY_DESCRIPTION = /đồng/i;

export const EXTRA_MONEY_FIELDS = Object.freeze([
  'afterDiscount', // DiscountPendingItemDto: "Sau chiết khấu (subtotal − amount)"
  'discountAmount', // PreviewTotalRequestDto/ResponseDto: "Chiết khấu — client ECHO …"
]);

/** Every numeric property in the contract: name -> list of descriptions. */
export function numericProperties() {
  const spec = JSON.parse(readFileSync(openapiPath, 'utf8'));
  const out = new Map();
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node === null || typeof node !== 'object') return;
    if (node.properties && typeof node.properties === 'object') {
      for (const [name, prop] of Object.entries(node.properties)) {
        if (prop && (prop.type === 'integer' || prop.type === 'number')) {
          if (!out.has(name)) out.set(name, []);
          out.get(name).push(prop.description ?? '');
        }
      }
    }
    Object.values(node).forEach(walk);
  };
  walk(spec);
  return out;
}

/** Money field names, sorted: derived from OpenAPI + the documented extras. */
export function moneyFields() {
  const props = numericProperties();
  const derived = [...props]
    .filter(([, descriptions]) => descriptions.some((d) => MONEY_DESCRIPTION.test(d)))
    .map(([name]) => name);
  return [...new Set([...derived, ...EXTRA_MONEY_FIELDS])].sort();
}
