/**
 * Contract type (FR-13) — PURE DOMAIN: no Nest, no Prisma.
 *
 * The SERVER derives the type from the order's scope flags; nobody picks it. `scopeThietBi` is
 * always `true` (`ScopePreset` invariant), so "equipment only" is exactly `!scopeThiCong` — there
 * is no third case. `scopeVanChuyen` does not affect the type.
 */
export const CONTRACT_TYPE = {
  /** "HĐ Thi công" — the order includes installation. */
  construction: 'construction',
  /** "HĐ Mua bán" — equipment only. */
  sale: 'sale',
} as const;

export type ContractType = (typeof CONTRACT_TYPE)[keyof typeof CONTRACT_TYPE];

/** Runtime list for the OpenAPI enum and the DB CHECK (`contracts_type_known`). */
export const CONTRACT_TYPES: readonly ContractType[] = [
  CONTRACT_TYPE.construction,
  CONTRACT_TYPE.sale,
];

export function contractTypeFor(order: {
  readonly scopeThiCong: boolean;
}): ContractType {
  return order.scopeThiCong ? CONTRACT_TYPE.construction : CONTRACT_TYPE.sale;
}

/**
 * Printed in a company legal-entity cell that nobody has configured yet. The contract is still
 * generated (F-4: never blocks). Customer data that is missing prints a dotted fill-in line
 * instead — this label is only for the company's own settings.
 */
export const NOT_CONFIGURED_LABEL = 'Chưa cấu hình';
