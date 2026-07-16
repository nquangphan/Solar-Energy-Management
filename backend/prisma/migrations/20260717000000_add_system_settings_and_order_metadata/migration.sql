-- Story 4.4: bảng cấu hình hệ thống + metadata Đơn.
-- Sinh OFFLINE (không có Postgres cục bộ) bằng
-- `prisma migrate diff --from-schema <schema HEAD> --to-schema prisma/schema.prisma --script`
-- — mirror chiến lược migration các bản trước.
--
-- `system_settings` là bảng key-value mirror khuôn `feature_flags`: bảng giữ TRẠNG THÁI,
-- registry (`settings/domain/setting-registry.ts`) giữ danh sách key hợp lệ + default.
-- Row vắng = default từ registry (vat.rate_percent → 8) — KHÔNG cần seed.
--
-- `orders.k_wp` Int → double precision AN TOÀN: cột tạo sẵn từ 4.1 chưa từng được ghi
-- (không hành vi) — công suất kWp bản chất là số lẻ ("8,82 kWp"), AD-10 integer chỉ áp
-- cho TIỀN. `validity_note` là chuỗi tự do hạn hiệu lực báo giá — Phase 1 chỉ hiển thị.

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "validity_note" TEXT,
ALTER COLUMN "k_wp" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);
