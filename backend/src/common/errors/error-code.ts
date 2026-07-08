/**
 * Enum mã lỗi CÓ TÀI LIỆU (AD-5). `code` trong error envelope là **string** lấy từ
 * đây — hợp đồng cross-repo: FE/mobile map lỗi theo **mã** (chuỗi ổn định), KHÔNG
 * theo `message` (message có thể đổi/đa ngôn ngữ). Vì vậy:
 *
 * - **KHÔNG** đổi/xoá một mã đã publish mà không cân nhắc breaking FE (FE gen type từ
 *   OpenAPI + so sánh theo mã này).
 * - Bộ khởi đầu **tối giản (YAGNI)**: chỉ mã cần cho skeleton + lỗi hạ tầng chung.
 * - **KHÔNG** nhét mã lỗi **domain** (pricing/VAT, transition, permission, tồn kho,
 *   trùng SĐT…) vào đây. Mỗi story domain tự khai mã của nó theo **cùng pattern**
 *   `as const` này, tái dùng `ErrorEnvelopeDto`. Xem `backend/CONVENTIONS.md#Error envelope`.
 *
 * Đây chính là "enum mã lỗi có tài liệu" mà AD-5 yêu cầu (TSDoc mỗi mã = tài liệu).
 */
export const ErrorCode = {
  /** 400 — Body/tham số không hợp lệ theo DTO (class-validator/ValidationPipe). Kèm `fieldErrors`. */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** 401 — Chưa xác thực (thiếu/không hợp lệ token). Luồng auth thật thuộc Story 2.3. */
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  /** 403 — Đã xác thực nhưng không đủ quyền. Guard quyền server-side thuộc Story 2.4/2.5. */
  FORBIDDEN: 'FORBIDDEN',
  /** 404 — Không tìm thấy tài nguyên. */
  NOT_FOUND: 'NOT_FOUND',
  /** 409 — Xung đột trạng thái (vd trùng khoá, vi phạm bất biến nghiệp vụ). */
  CONFLICT: 'CONFLICT',
  /** 500 — Lỗi không lường trước. Response trả message generic, KHÔNG leak chi tiết; log đầy đủ server-side. */
  INTERNAL: 'INTERNAL',
} as const;

/** Kiểu union của mọi mã lỗi hợp lệ (`'VALIDATION_ERROR' | 'UNAUTHENTICATED' | …`). */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
