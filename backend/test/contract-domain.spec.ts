import {
  CONTRACT_BLOCKED_MESSAGE,
  CONTRACT_ORDER_STATUSES,
  contractBlocker,
  scheduleLabelOf,
} from '../src/contracts/domain/contract-eligibility';
import {
  contractFileName,
  contractPdfKey,
  formatContractNo,
} from '../src/contracts/domain/contract-number';
import {
  CONTRACT_TYPE,
  contractTypeFor,
} from '../src/contracts/domain/contract-type';
import { quoteNumberOf } from '../src/orders/domain/quote-number';

describe('contract domain', () => {
  describe('contractTypeFor — derived from the scope flags', () => {
    it('installation flag on ⇒ construction', () => {
      expect(contractTypeFor({ scopeThiCong: true })).toBe(
        CONTRACT_TYPE.construction,
      );
    });

    it('equipment only ⇒ sale', () => {
      expect(contractTypeFor({ scopeThiCong: false })).toBe(CONTRACT_TYPE.sale);
    });
  });

  describe('formatContractNo — year in UTC+7', () => {
    it('31/12 17:30 UTC is already next year in Vietnam', () => {
      expect(
        formatContractNo(
          CONTRACT_TYPE.construction,
          7,
          new Date('2026-12-31T17:30:00Z'),
        ),
      ).toBe('HĐTC-7/2027');
    });

    it('31/12 16:59:59 UTC is still this year', () => {
      expect(
        formatContractNo(
          CONTRACT_TYPE.sale,
          7,
          new Date('2026-12-31T16:59:59Z'),
        ),
      ).toBe('HĐMB-7/2026');
    });

    it('file name is ASCII; key is per contract id', () => {
      expect(contractFileName(CONTRACT_TYPE.construction, 12)).toBe(
        'hop-dong-thi-cong-12',
      );
      expect(contractFileName(CONTRACT_TYPE.sale, 12)).toBe(
        'hop-dong-mua-ban-12',
      );
      expect(contractPdfKey('o-1', 'c-1')).toBe('contracts/o-1/c-1.pdf');
    });
  });

  it('quoteNumberOf = first 8 chars of the order id, upper-cased', () => {
    expect(quoteNumberOf('3f2a9b1c-aaaa-bbbb-cccc-dddddddddddd')).toBe(
      'BG-3F2A9B1C',
    );
  });

  describe('contractBlocker — fixed order of checks', () => {
    const ok = {
      status: 'dachot',
      lineCount: 2,
      hasSchedule: true,
      scheduleTotal: 100,
      orderTotal: 100,
    };

    it('eligible ⇒ null', () => {
      expect(contractBlocker(ok)).toBeNull();
    });

    it.each(['baogia', 'choduyet', 'huy'])(
      'status %s ⇒ 409 status message',
      (status) => {
        expect(contractBlocker({ ...ok, status })).toEqual({
          status: 409,
          message: CONTRACT_BLOCKED_MESSAGE.status,
        });
      },
    );

    it('every confirmed status (incl. hoanthanh) is eligible', () => {
      expect([...CONTRACT_ORDER_STATUSES].sort()).toEqual(
        [
          'dachot',
          'dacoc',
          'thicong',
          'nghiemthu',
          'danggiao',
          'dagiao',
          'hoanthanh',
        ].sort(),
      );
      for (const status of CONTRACT_ORDER_STATUSES) {
        expect(contractBlocker({ ...ok, status })).toBeNull();
      }
    });

    it('no lines ⇒ 400', () => {
      expect(contractBlocker({ ...ok, lineCount: 0 })).toEqual({
        status: 400,
        message: CONTRACT_BLOCKED_MESSAGE.noLines,
      });
    });

    it('no schedule ⇒ 409', () => {
      expect(
        contractBlocker({ ...ok, hasSchedule: false, scheduleTotal: 0 }),
      ).toEqual({ status: 409, message: CONTRACT_BLOCKED_MESSAGE.noSchedule });
    });

    it('schedule does not add up ⇒ 409', () => {
      expect(contractBlocker({ ...ok, scheduleTotal: 99 })).toEqual({
        status: 409,
        message: CONTRACT_BLOCKED_MESSAGE.scheduleMismatch,
      });
    });

    it('status wins over lines, lines over schedule, schedule over mismatch', () => {
      expect(
        contractBlocker({
          status: 'huy',
          lineCount: 0,
          hasSchedule: false,
          scheduleTotal: 1,
          orderTotal: 2,
        })?.message,
      ).toBe(CONTRACT_BLOCKED_MESSAGE.status);
      expect(
        contractBlocker({
          ...ok,
          lineCount: 0,
          hasSchedule: false,
          scheduleTotal: 1,
        })?.message,
      ).toBe(CONTRACT_BLOCKED_MESSAGE.noLines);
      expect(
        contractBlocker({ ...ok, hasSchedule: false, scheduleTotal: 1 })
          ?.message,
      ).toBe(CONTRACT_BLOCKED_MESSAGE.noSchedule);
    });
  });

  describe('scheduleLabelOf', () => {
    it('all by percent ⇒ "20/70/10"', () => {
      expect(
        scheduleLabelOf([{ percent: 20 }, { percent: 70 }, { percent: 10 }]),
      ).toBe('20/70/10');
    });

    it('any by amount ⇒ "N đợt"', () => {
      expect(
        scheduleLabelOf([{ percent: 30 }, { percent: null }, { percent: 20 }]),
      ).toBe('3 đợt');
    });

    it('no schedule ⇒ null', () => {
      expect(scheduleLabelOf(null)).toBeNull();
      expect(scheduleLabelOf([])).toBeNull();
    });
  });
});
