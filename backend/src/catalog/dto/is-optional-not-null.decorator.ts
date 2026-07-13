import { ValidateIf } from 'class-validator';

/**
 * "Vắng mặt thì thôi, nhưng gửi `null` là SAI" — cho cột KHÔNG nullable ở DB.
 *
 * KHÔNG dùng `@IsOptional()` cho những cột này: nó tắt MỌI validator khi giá trị là
 * `undefined` **hoặc `null`**. Hệ quả: `{"price": null}` lọt qua `ValidationPipe` rồi đi
 * thẳng xuống Prisma trên một cột NOT NULL — vỡ ở tầng DB thành 500, thay vì 400 kèm
 * `fieldErrors` chỉ đúng ô nhập.
 *
 * `@ValidateIf` chỉ tha `undefined` (vắng mặt thật sự — PATCH bỏ qua field đó); `null` vẫn
 * phải đi qua `@IsInt()`/`@IsString()`… và bị chặn ở đó.
 *
 * KHÔNG dùng cho `warrantyMonths`: ở đó `null` là giá trị NGHIỆP VỤ hợp lệ ("không bảo
 * hành" — công lắp, phí lắp đặt), nên nó vẫn dùng `@IsOptional()`.
 */
export const IsOptionalNotNull = (): PropertyDecorator =>
  ValidateIf((_object, value) => value !== undefined);
