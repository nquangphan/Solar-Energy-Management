// hand-authored — web-only design-system component (Story 1.6).
import { useState } from 'react';
import { Icon } from '../icons/Icon';
import { Money } from './Money';

/** How the warranty cell renders for this line (Story 4.9). */
export type WarrantyMode = 'input' | 'none' | 'link';

/**
 * Format a warranty duration for display: whole years as "X năm", else "X tháng",
 * `null` as empty. SAME rule as the backend `formatWarranty` (quote-template) and
 * the Flutter twin — one rule in three places, pinned by the parity guard. This is
 * a TIME-UNIT format, not money arithmetic (`%`/`/` only, no `*`/toFixed) so it
 * does not touch the component's money invariant (AD-10/16).
 */
export function formatWarrantyMonths(months: number | null): string {
  if (months === null) return '';
  // `months % 12 === 0` guarantees `months / 12` is a whole number — safe on web
  // (Dart twin must use integer division `~/`).
  return months % 12 === 0 ? `${months / 12} năm` : `${months} tháng`;
}

/**
 * Stock hint under the line name (quote early warning). Display only — the
 * label is built by the SCREEN from backend figures, `short` picks the tone. It
 * never affects money and never blocks anything.
 */
export interface CartLineStockHint {
  label: string;
  short: boolean;
}

export interface CartLineRowProps {
  name: string;
  sku?: string;
  meta?: string;
  qty: number;
  unitPrice: number;
  // The line total. Taken STRAIGHT from this prop — the backend computes it
  // (POST /orders/preview-total, AD-10/16). The component never computes money
  // (no qty × unitPrice, no sum); it displays it via formatVnd (<Money>).
  amount: number;
  editable?: boolean;
  // Gate the UNIT-PRICE input separately from qty (Story 4.1): qty is editable
  // on every line of a draft quote, but the price only when the line allows it
  // (free line / Product.priceEditable). Defaults to `editable` so pre-4.1
  // callers keep their behavior.
  priceEditable?: boolean;
  // Warranty column (Story 4.9). `warrantyMode` is derived by the SCREEN from the
  // line type: install/labour catalogue line → 'none' (shows "Không có", no input);
  // free line without a warranty yet → 'link' (a "+ Thêm bảo hành" control that
  // reveals the input); every other line → 'input'. `warrantyEditable` gates the
  // input vs read-only text (draft + permission). Empty input commits `null`.
  warrantyMonths?: number | null;
  warrantyMode?: WarrantyMode;
  warrantyEditable?: boolean;
  onWarrantyChange?: (months: number | null) => void;
  flag?: string; // display-only badge (e.g. "linh động"/"dự kiến") — never affects price
  stockHint?: CartLineStockHint;
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
 * Money invariant (AD-10/16): `amount` is a backend number passed by the caller.
 * This component never computes money (no qty × unitPrice, no total — pricing
 * lives in orders/domain on the backend); it displays via formatVnd (<Money>).
 * The unit-price INPUT keeps raw digits for typing.
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
  priceEditable,
  warrantyMonths = null,
  warrantyMode = 'input',
  warrantyEditable,
  onWarrantyChange,
  flag,
  stockHint,
  zebra,
  onQtyChange,
  onUnitPriceChange,
  onDelete,
}: CartLineRowProps) {
  const cls = ['', zebra && 'zebra'].filter(Boolean).join(' ').trim() || undefined;
  // Undefined = follow `editable` (back-compat); explicit false = read-only price.
  const priceInputOn = priceEditable ?? editable;
  // Warranty input is editable only when the caller says so AND the mode allows it.
  const warrantyInputOn = (warrantyEditable ?? false) && warrantyMode !== 'none';
  // Local draft for the bare warranty input — commit-on-blur (empty = null). Local
  // reveal state for 'link' mode (mockup: "+ Thêm bảo hành" flips to the input).
  const [warrantyText, setWarrantyText] = useState(
    warrantyMonths === null ? '' : String(warrantyMonths),
  );
  const [warrantyRevealed, setWarrantyRevealed] = useState(false);

  function commitWarranty() {
    const trimmed = warrantyText.trim();
    if (trimmed === '') {
      onWarrantyChange?.(null);
      return;
    }
    const n = Number(trimmed);
    // Guard against NaN / non-integer reaching the port; ignore invalid input.
    if (Number.isInteger(n) && n >= 1) onWarrantyChange?.(n);
  }

  const warrantyInput = (
    <input
      className="field"
      inputMode="numeric"
      aria-label="Bảo hành (tháng)"
      value={warrantyText}
      autoFocus={warrantyRevealed}
      onChange={(e) => setWarrantyText(e.target.value)}
      onBlur={commitWarranty}
    />
  );

  let warrantyCell;
  if (warrantyMode === 'none') {
    warrantyCell = <span className="micro muted">Không có</span>;
  } else if (!warrantyInputOn) {
    warrantyCell = <span className="num mono">{formatWarrantyMonths(warrantyMonths)}</span>;
  } else if (warrantyMode === 'link' && !warrantyRevealed) {
    warrantyCell = (
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => setWarrantyRevealed(true)}
      >
        + Thêm bảo hành
      </button>
    );
  } else {
    warrantyCell = warrantyInput;
  }

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
        {stockHint && (
          <>
            <br />
            <span className={stockHint.short ? 'stock-hint stock-hint--short' : 'stock-hint'}>
              {stockHint.label}
            </span>
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
            onChange={(e) => {
              const n = Number(e.target.value);
              // Guard against NaN from non-numeric input reaching preview-total.
              if (Number.isFinite(n)) onQtyChange?.(n);
            }}
          />
        ) : (
          <span className="num mono">{qty}</span>
        )}
      </td>
      <td className="num">{warrantyCell}</td>
      <td className="num">
        {priceInputOn ? (
          <input
            className="field"
            inputMode="numeric"
            aria-label="Đơn giá"
            value={unitPrice}
            onChange={(e) => {
              const n = Number(e.target.value);
              // Guard against NaN from non-numeric input reaching preview-total.
              if (Number.isFinite(n)) onUnitPriceChange?.(n);
            }}
          />
        ) : (
          <Money value={unitPrice} />
        )}
      </td>
      <td className="num strong mono">
        <Money value={amount} />
      </td>
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
