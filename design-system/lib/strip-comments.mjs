/**
 * Xoá comment khỏi source TRƯỚC KHI source-guard scan chuỗi cấm — dùng chung cho mọi guard
 * đọc-.tsx/.dart/.css-như-text (C-11, retro Epic 3).
 *
 * Vì sao phải có: guard quét raw source cho chuỗi cấm (`box-shadow`, `react-router`, `fetch`,
 * `.toUpperCase()`…). Nếu không strip, chính một CÂU GIẢI THÍCH trong comment ("must not add
 * box-shadow") làm guard đỏ oan. Người sau "sửa" bằng cách né viết chuỗi trong comment — mất luôn
 * câu giải thích, và hiểu sai vì sao guard tồn tại. Strip comment ⇒ guard chỉ nhìn CODE THẬT.
 *
 * Tiêu chí (retro): chèn chuỗi cấm vào COMMENT ⇒ guard KHÔNG fail; vào CODE thật ⇒ VẪN fail.
 *
 * Naive theo chủ ý: không parse chuỗi/URL, nên `//` bên trong một string literal cũng bị cắt.
 * Chấp nhận được cho mục đích guard, và đây đúng khuôn regex các bản sao cũ đã dùng — trích ra một
 * chỗ để mọi guard cắt GIỐNG NHAU, thay vì 6 bản sao lệch nhau (login chỉ cắt dòng, số khác cắt cả
 * hai kiểu). Cắt comment-khối trước, rồi comment-dòng.
 */
export const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
