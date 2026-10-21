import { MOC_TU_DONG } from '../src/orders/domain/auto-transition-map';
import {
  EDITABLE_ORDER_STATUSES,
  MAX_INSTALLMENT_AMOUNT,
  SCHEDULE_ERROR,
  isSameSchedule,
  resolveInstallments,
  type InstallmentInput,
  type ResolvedInstallment,
} from '../src/payments/domain/payment-schedule';

/**
 * Pure-domain tests for payment schedule resolution (FR-11, AD-10). Expected numbers in the
 * fixed cases are worked out by hand; the seeded loop checks invariants of the real function
 * over many totals instead of hand-picked fixtures.
 */

const pct = (percent: number, conditionNote = 'n'): InstallmentInput => ({
  percent,
  conditionNote,
});
const amt = (amount: number, conditionNote = 'n'): InstallmentInput => ({
  amount,
  conditionNote,
});

function resolvedOrThrow(total: number, inputs: InstallmentInput[]) {
  const result = resolveInstallments(total, inputs);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result;
}

describe('resolveInstallments', () => {
  it('mockup 20/70/10 on 83,010,960 splits exactly with milestones by position', () => {
    const result = resolvedOrThrow(83_010_960, [pct(20), pct(70), pct(10)]);
    expect(result.installments.map((i) => i.amount)).toEqual([
      16_602_192, 58_107_672, 8_301_096,
    ]);
    expect(result.installments.map((i) => i.milestone)).toEqual([
      MOC_TU_DONG.coc,
      null,
      MOC_TU_DONG.tatToan,
    ]);
    expect(result.installments.map((i) => i.seq)).toEqual([1, 2, 3]);
    expect(result.scheduledTotal).toBe(83_010_960);
  });

  it('gives the rounding remainder to the last installment when all-percent sums to 100', () => {
    const result = resolvedOrThrow(100_000_001, [pct(20), pct(70), pct(10)]);
    expect(result.installments.map((i) => i.amount)).toEqual([
      20_000_000, 70_000_000, 10_000_001,
    ]);
    expect(result.scheduledTotal).toBe(100_000_001);
  });

  it('single 100% installment equals the total and is the deposit', () => {
    const result = resolvedOrThrow(12_345_679, [pct(100)]);
    expect(result.installments).toEqual([
      {
        seq: 1,
        percent: 100,
        amount: 12_345_679,
        conditionNote: 'n',
        milestone: MOC_TU_DONG.coc,
      },
    ]);
  });

  it('mixed percent/amount keeps each input kind and adds no remainder', () => {
    const result = resolvedOrThrow(100_000_001, [
      amt(30_000_000),
      pct(50),
      amt(20_000_000),
    ]);
    expect(result.installments.map((i) => [i.percent, i.amount])).toEqual([
      [null, 30_000_000],
      [50, 50_000_000],
      [null, 20_000_000],
    ]);
    expect(result.scheduledTotal).toBe(100_000_000);
  });

  it('percents not summing to 100 get no top-up (60/60 over, 20/70 under)', () => {
    expect(resolvedOrThrow(1_000_001, [pct(60), pct(60)]).scheduledTotal).toBe(
      600_000 + 600_000,
    );
    expect(resolvedOrThrow(1_000_001, [pct(20), pct(70)]).scheduledTotal).toBe(
      200_000 + 700_000,
    );
  });

  it('blocks a first installment of 0 amount', () => {
    expect(resolveInstallments(1_000_000, [amt(0), pct(100)])).toEqual({
      ok: false,
      errors: [
        {
          field: 'installments.0.amount',
          code: SCHEDULE_ERROR.firstInstallmentZero,
        },
      ],
    });
  });

  it('blocks a first installment of 0 percent', () => {
    const result = resolveInstallments(1_000_000, [pct(0), pct(100)]);
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          field: 'installments.0.amount',
          code: SCHEDULE_ERROR.firstInstallmentZero,
        },
      ],
    });
  });

  it('blocks a first percent that resolves to 0 dong on a tiny total', () => {
    // floor(50 * 1 / 100) = 0
    const result = resolveInstallments(50, [pct(1), pct(99)]);
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          field: 'installments.0.amount',
          code: SCHEDULE_ERROR.firstInstallmentZero,
        },
      ],
    });
  });

  it('blocks a middle percent that resolves to 0 dong', () => {
    // 50 total: 50% = 25, 1% = 0, 50% = 25 (sum 101, no top-up)
    const result = resolveInstallments(50, [pct(50), pct(1), pct(50)]);
    expect(result).toEqual({
      ok: false,
      errors: [
        { field: 'installments.1.amount', code: SCHEDULE_ERROR.resolvedZero },
      ],
    });
  });

  it('blocks a percent that resolves above the INT4-safe cap, at the boundary exactly', () => {
    // 4,000,000,002 total: 50% = 2,000,000,001 (> cap) and the topped-up last 50% too;
    // 4,000,000,000 total: 50% = 2,000,000,000 (= cap) saves.
    expect(resolveInstallments(4_000_000_002, [pct(50), pct(50)])).toEqual({
      ok: false,
      errors: [0, 1].map((i) => ({
        field: `installments.${i}.amount`,
        code: SCHEDULE_ERROR.amountTooLarge,
      })),
    });
    expect(
      resolvedOrThrow(4_000_000_000, [pct(50), pct(50)]).installments.map(
        (i) => i.amount,
      ),
    ).toEqual([MAX_INSTALLMENT_AMOUNT, MAX_INSTALLMENT_AMOUNT]);
  });

  it('a large order still saves when split so every installment fits the cap', () => {
    const result = resolvedOrThrow(5_000_000_000, [pct(40), pct(30), pct(30)]);
    expect(result.scheduledTotal).toBe(5_000_000_000);
    expect(
      result.installments.every((i) => i.amount <= MAX_INSTALLMENT_AMOUNT),
    ).toBe(true);
  });

  it('a zero total (order without lines) rejects any percent schedule at the first installment', () => {
    const result = resolveInstallments(0, [pct(100)]);
    expect(result.ok).toBe(false);
  });

  it('requires exactly one of percent/amount per installment', () => {
    const result = resolveInstallments(1_000_000, [
      { percent: 20, amount: 200_000, conditionNote: 'both' },
      { conditionNote: 'neither' },
      { percent: null, amount: null, conditionNote: 'nulls' },
    ]);
    expect(result).toEqual({
      ok: false,
      errors: [0, 1, 2].map((i) => ({
        field: `installments.${i}.percent`,
        code: SCHEDULE_ERROR.exactlyOneOf,
      })),
    });
  });

  it.each([
    [1, [MOC_TU_DONG.coc]],
    [2, [MOC_TU_DONG.coc, MOC_TU_DONG.tatToan]],
    [5, [MOC_TU_DONG.coc, null, null, null, MOC_TU_DONG.tatToan]],
  ])('%i installments get milestones by position', (count, expected) => {
    const inputs = Array.from({ length: count }, () => amt(1_000));
    expect(
      resolvedOrThrow(1_000_000, inputs).installments.map((i) => i.milestone),
    ).toEqual(expected);
  });

  it('every output is an integer and all-percent-100 schedules sum to the total (seeded loop)', () => {
    let seed = 20261021;
    const next = (max: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % max;
    };
    const splits = [
      [20, 70, 10],
      [30, 30, 40],
      [33, 33, 34],
      [1, 98, 1],
      [100],
      [50, 50],
    ];
    for (let n = 0; n < 500; n++) {
      const total = 1_000 + next(1_999_999_000);
      const split = splits[n % splits.length];
      const result = resolvedOrThrow(
        total,
        split.map((p) => pct(p)),
      );
      for (const [i, inst] of result.installments.entries()) {
        expect(Number.isInteger(inst.amount)).toBe(true);
        if (i < split.length - 1) {
          expect(inst.amount).toBe(Math.floor((total * split[i]) / 100));
        }
      }
      expect(result.scheduledTotal).toBe(total);
    }
  });
});

describe('isSameSchedule', () => {
  const base: ResolvedInstallment[] = [
    { seq: 1, percent: 20, amount: 200, conditionNote: 'a', milestone: 'coc' },
    {
      seq: 2,
      percent: null,
      amount: 800,
      conditionNote: 'b',
      milestone: 'tat_toan',
    },
  ];

  it('is true for an identical list', () => {
    expect(
      isSameSchedule(
        base,
        base.map((i) => ({ ...i })),
      ),
    ).toBe(true);
  });

  it.each([
    ['length', base.slice(0, 1)],
    ['percent', [{ ...base[0], percent: 21 }, base[1]]],
    ['amount', [{ ...base[0], amount: 201 }, base[1]]],
    ['conditionNote', [{ ...base[0], conditionNote: 'x' }, base[1]]],
    ['milestone', [base[0], { ...base[1], milestone: null }]],
  ])('is false when %s differs', (_label, other) => {
    expect(isSameSchedule(base, other as ResolvedInstallment[])).toBe(false);
  });
});

describe('EDITABLE_ORDER_STATUSES', () => {
  it('is the confirmed-and-open set', () => {
    expect([...EDITABLE_ORDER_STATUSES].sort()).toEqual(
      ['dachot', 'dacoc', 'thicong', 'nghiemthu', 'danggiao', 'dagiao'].sort(),
    );
  });
});
