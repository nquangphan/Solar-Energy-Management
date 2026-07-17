/**
 * Thông tin công ty trên báo giá — hằng VERBATIM từ mẫu thật
 * (`docs/2. Thương mại/Báo giá thương mại.xlsx`, trích 2026-07-17).
 *
 * KHÔNG SystemSetting (YAGNI — AC không đòi cấu hình được; đổi thông tin = sửa hằng,
 * hiếm). Giữ nguyên chính tả gốc của mẫu, kể cả chỗ viết hoa/space lạ.
 */
export const COMPANY_INFO = {
  name: 'CÔNG TY TNHH GIẢI PHÁP NĂNG LƯỢNG MẶT TRỜI PHƯƠNG NAM',
  taxCode: 'Mã số thuế: 3702893374',
  addresses: [
    'ĐC: 61/4C Đường Bùi Thị Xuân, KP Tân Phước, Phường Tân Đông Hiệp, TP Hồ Chí Minh, Việt Nam',
    'ĐC Văn phòng đại diện: Khu phức hợp Charm city, Tầng 3 A01-03, số 115 đường DT 743C ,kp thống nhất, phường Dĩ An, TP HCM',
    'ĐC Kho chính: 67 Đường số 9, Tân Đông Hiệp, Hồ Chí Minh, Việt Nam.',
  ],
  quoteTitle: 'BÁO GIÁ KIÊM ĐƠN ĐẶT HÀNG',
  currencyLabel: 'VNĐ',
  paymentTerms: 'Điều khoản thanh toán: thanh toán 100% xuất hàng tại kho',
  bankHeading: 'TK THANH TOÁN:',
  bankLine:
    '1. CÔNG TY: Tên TK: CÔNG TY TNHH GIẢI PHÁP NĂNG LƯỢNG MẶT TRỜI PHƯƠNG NAM : 123 222 039 tại Ngân hàng VIB - Chi Nhánh Dĩ An, Bình Dương',
  signLeftTitle: 'Người lập phiếu',
  signLeftNote: '(Ký, họ tên)',
  signRightTitle: 'Giám đốc',
  signRightNote: '(Ký, họ tên, đóng dấu)',
  footer:
    'PHƯƠNG NAM SOLAR HIỆN LÀ NHÀ PHÂN PHỐI CHÍNH THỨC DÒNG SẢN PHẨM TẤM PIN CANADIAN THƯƠNG HIỆU CANADA, THORNOVA THƯƠNG HIỆU USA, JA THƯƠNG HIỆU JA SOLAR, AE THƯƠNG HIỆU AE SOLAR ĐỒNG THỜI LÀ ĐƠN VỊ BẢO HÀNH  EJOR, SAJ TẠI VIỆT NAM.',
} as const;
