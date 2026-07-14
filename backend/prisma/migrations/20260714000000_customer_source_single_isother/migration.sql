-- Bịt bất biến "đúng MỘT dòng cờ isOther" ở TẦNG DB (C-7, retro Epic 3).
--
-- Trước đây bất biến này chỉ được canh ở tầng app (service từ chối tạo/đổi dòng thứ hai) và ở
-- seed. Mutation test 3.5 đã CHỨNG MINH nó vỡ được: một seed upsert-theo-tên lỗi đã tạo dòng
-- isOther thứ hai, làm DB hỏng cho tới khi dọn tay. Partial unique index dưới đây làm Postgres
-- TỪ CHỐI dòng isOther thứ hai ngay ở tầng lưu trữ — nguồn chân lý cuối cùng.
--
-- Prisma schema DSL không biểu diễn được partial/filtered unique index ⇒ migration thủ công.
-- Dự án dùng `prisma migrate diff --script` + `migrate deploy` (KHÔNG `migrate dev`), nên index
-- không-có-trong-schema này không gây reset drift.
CREATE UNIQUE INDEX "customer_sources_single_is_other"
  ON "customer_sources" ("is_other")
  WHERE "is_other";
