// hand-authored — web-only design-system component (Story 1.6).
import { Icon } from '../icons/Icon';

export interface CartLineRowProps {
  name: string;
  sku?: string;
  meta?: string;
  qty: number;
  unitPrice: number;
  // The line total. Rendered STRAIGHT from this prop — the backend computes it
  // (POST /orders/preview-total, AD-10/16). The component never multiplies
  // qty × unitPrice, never sums, never formats money.
  amount: number;
  editable?: boolean;
  flag?: string; // display-only badge (e.g. "linh động"/"dự kiến") — never affects price
  zebra?: boolean;
  onQtyChange?: (qty: number) => void;
  onUnitPriceChange?: (unitPrice: number) => void;
  onDelete?: () => void;
}

/**
 * A single cart line rendered as a <tr> to place inside <Table><tbody> (Story
 * 1.5). Edits emit immediately via callbacks (no save button, AC-1): the SCREEN
 * calls preview-total on each emit and re-renders the backend-computed amount.
 *
 * Money invariant (AD-10/16): `amount` is a backend number passed by the caller
 * and rendered as-is. This component does NOT compute qty × unitPrice or any
 * total — pricing lives in orders/domain on the backend.
 *
 * Web deletes via a button (AC-1). Swipe-to-delete is a mobile/Flutter concern
 * (Story 1.7) and is intentionally not implemented here. Overlap ≤ 1 level: the
 * screen owns qty/unitPrice/amount state; this row is stateless.
 */
export function CartLineRow({
  name,
  sku,
  meta,
  qty,
  unitPrice,
  amount,
  editable,
  flag,
  zebra,
  onQtyChange,
  onUnitPriceChange,
  onDelete,
}: CartLineRowProps) {
  const cls = ['', zebra && 'zebra'].filter(Boolean).join(' ').trim() || undefined;
  return (
    <tr className={cls}>
      <td>
        <span className="strong">{name}</span>
        {(sku || meta) && (
          <>
            <br />
            <span className="micro muted">{sku || meta}</span>
          </>
        )}
        {flag && (
          <>
            <br />
            <span className="micro muted">{flag}</span>
          </>
        )}
      </td>
      <td className="num">
        {editable ? (
          <input
            className="field"
            inputMode="numeric"
            aria-label="Số lượng"
            value={qty}
            onChange={(e) => onQtyChange?.(Number(e.target.value))}
          />
        ) : (
          <span className="num mono">{qty}</span>
        )}
      </td>
      <td className="num">
        {editable ? (
          <input
            className="field"
            inputMode="numeric"
            aria-label="Đơn giá"
            value={unitPrice}
            onChange={(e) => onUnitPriceChange?.(Number(e.target.value))}
          />
        ) : (
          <span className="num mono">{unitPrice}</span>
        )}
      </td>
      <td className="num strong mono">{amount}</td>
      {onDelete && (
        <td className="num">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            aria-label="Xoá dòng"
            onClick={onDelete}
          >
            <Icon name="ic-trash" />
          </button>
        </td>
      )}
    </tr>
  );
}
