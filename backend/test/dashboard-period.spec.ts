import {
  DASHBOARD_PERIODS,
  periodRange,
  vietnamRangeToInstants,
} from '../src/dashboard/domain/dashboard-period';

/**
 * Dashboard period boundaries (G-6): periods are Vietnam calendar days (UTC+7), the week starts on
 * Monday, and both ends are inclusive. Inputs are instants; every expected date below is read off
 * a wall calendar by hand, never produced by the function under test.
 */
describe('dashboard period', () => {
  it('lists exactly day, week and month', () => {
    expect([...DASHBOARD_PERIODS]).toEqual(['day', 'week', 'month']);
  });

  describe('Sunday 23:30 in Vietnam (16:30Z) is still Sunday', () => {
    const now = new Date('2026-10-25T16:30:00Z');

    it('day is that Sunday', () => {
      expect(periodRange('day', now)).toEqual({
        from: '2026-10-25',
        to: '2026-10-25',
      });
    });

    it('week runs Monday to that Sunday', () => {
      expect(periodRange('week', now)).toEqual({
        from: '2026-10-19',
        to: '2026-10-25',
      });
    });

    it('month runs from the 1st', () => {
      expect(periodRange('month', now)).toEqual({
        from: '2026-10-01',
        to: '2026-10-25',
      });
    });
  });

  describe('Monday 00:10 in Vietnam (Sunday 17:10Z) is already Monday', () => {
    const now = new Date('2026-10-25T17:10:00Z');

    it('day is that Monday', () => {
      expect(periodRange('day', now)).toEqual({
        from: '2026-10-26',
        to: '2026-10-26',
      });
    });

    it('week on a Monday is that single day', () => {
      expect(periodRange('week', now)).toEqual({
        from: '2026-10-26',
        to: '2026-10-26',
      });
    });
  });

  it('the 1st of the month: month is one day, week reaches back into the previous month', () => {
    const now = new Date('2026-10-01T01:00:00Z'); // Thursday 08:00 in Vietnam
    expect(periodRange('month', now)).toEqual({
      from: '2026-10-01',
      to: '2026-10-01',
    });
    expect(periodRange('week', now)).toEqual({
      from: '2026-09-28',
      to: '2026-10-01',
    });
  });

  it('31/12 → 01/01: New Year 00:30 in Vietnam belongs to the new year', () => {
    const now = new Date('2026-12-31T17:30:00Z'); // Friday 2027-01-01 00:30 in Vietnam
    expect(periodRange('day', now)).toEqual({
      from: '2027-01-01',
      to: '2027-01-01',
    });
    expect(periodRange('month', now)).toEqual({
      from: '2027-01-01',
      to: '2027-01-01',
    });
    expect(periodRange('week', now)).toEqual({
      from: '2026-12-28',
      to: '2027-01-01',
    });
  });

  it('leap February: 29th is in February, the next morning is March', () => {
    expect(periodRange('month', new Date('2028-02-29T03:00:00Z'))).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
    // 2028-03-01 06:00 in Vietnam, a Wednesday.
    const march = new Date('2028-02-29T23:00:00Z');
    expect(periodRange('day', march)).toEqual({
      from: '2028-03-01',
      to: '2028-03-01',
    });
    expect(periodRange('week', march)).toEqual({
      from: '2028-02-28',
      to: '2028-03-01',
    });
  });

  describe('Vietnam days → half-open instant range for UTC instant columns', () => {
    it('starts at 00:00 +07:00 (17:00Z the day before) and ends at the next midnight', () => {
      expect(
        vietnamRangeToInstants({ from: '2026-10-26', to: '2026-10-26' }),
      ).toEqual({
        fromInstant: new Date('2026-10-25T17:00:00.000Z'),
        toExclusive: new Date('2026-10-26T17:00:00.000Z'),
      });
    });

    it('crosses a year end', () => {
      expect(
        vietnamRangeToInstants({ from: '2026-12-28', to: '2027-01-01' }),
      ).toEqual({
        fromInstant: new Date('2026-12-27T17:00:00.000Z'),
        toExclusive: new Date('2027-01-01T17:00:00.000Z'),
      });
    });

    it('steps over a leap day', () => {
      expect(
        vietnamRangeToInstants({ from: '2028-02-01', to: '2028-02-29' }),
      ).toEqual({
        fromInstant: new Date('2028-01-31T17:00:00.000Z'),
        toExclusive: new Date('2028-02-29T17:00:00.000Z'),
      });
    });
  });
});
