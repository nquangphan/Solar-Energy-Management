import { amountInWords } from '../src/contracts/domain/amount-in-words';

/**
 * `amountInWords` — the "(Bằng chữ: …)" sentence of a contract.
 *
 * The first block uses amounts and wording taken from the two real company templates
 * (`docs/1. Khảo sát lắp đặt/HĐ THI CÔNG CT .docx`, `docs/2. Thương mại/HDMB CT QTS l2.pdf`).
 * The templates add decorative commas and a trailing "./."; the expectations below are those
 * sentences normalised to the rules of the function (no commas, ends with " đồng").
 */
describe('amountInWords', () => {
  describe('amounts printed in the real templates', () => {
    it.each([
      [145_000_000, 'Một trăm bốn mươi lăm triệu đồng'],
      [29_000_000, 'Hai mươi chín triệu đồng'],
      [14_500_000, 'Mười bốn triệu năm trăm ngàn đồng'],
      [101_500_000, 'Một trăm lẻ một triệu năm trăm ngàn đồng'],
      [50_275_000, 'Năm mươi triệu hai trăm bảy mươi lăm ngàn đồng'],
    ])('%i ⇒ %s', (amount, words) => {
      expect(amountInWords(amount)).toBe(words);
    });
  });

  describe('edges of the reading rules', () => {
    it.each([
      [0, 'Không đồng'],
      [5, 'Năm đồng'],
      [10, 'Mười đồng'],
      [15, 'Mười lăm đồng'],
      [21, 'Hai mươi mốt đồng'],
      [25, 'Hai mươi lăm đồng'],
      [11, 'Mười một đồng'],
      [105, 'Một trăm lẻ năm đồng'],
      [1_005_000, 'Một triệu không trăm lẻ năm ngàn đồng'],
      [1_000_000_000, 'Một tỷ đồng'],
      [1_000_000_005, 'Một tỷ không trăm lẻ năm đồng'],
      [
        2_147_483_647,
        'Hai tỷ một trăm bốn mươi bảy triệu bốn trăm tám mươi ba ngàn sáu trăm bốn mươi bảy đồng',
      ],
      [
        83_010_960,
        'Tám mươi ba triệu không trăm mười ngàn chín trăm sáu mươi đồng',
      ],
      [1_000_000_000_000, 'Một ngàn tỷ đồng'],
    ])('%i ⇒ %s', (amount, words) => {
      expect(amountInWords(amount)).toBe(words);
    });
  });

  it.each([-1, 1.5, Number.NaN, 1e15])(
    '%p is out of range ⇒ RangeError',
    (amount) => {
      expect(() => amountInWords(amount)).toThrow(RangeError);
    },
  );
});
