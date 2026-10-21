import { ValidateIf, registerDecorator } from 'class-validator';

/**
 * "Field này CÓ MẶT trong body là sai" — dùng cho field BẤT BIẾN (`sdt` ở `PATCH /customers/:phone`).
 *
 * Vì sao không chỉ… bỏ field ra khỏi DTO: `ValidationPipe({ whitelist: true })` **âm thầm
 * cắt** field không khai báo. Client gửi `{"sdt": "+84…"}` sẽ nhận 200 và tin rằng mình vừa đổi
 * SĐT — trong khi backend lặng lẽ vứt nó đi. Đổi SĐT là đổi KHOÁ CHÍNH (đổi danh tính, mà Epic 4
 * sẽ FK vào); câu trả lời đúng là **400 nói thẳng**, không phải im lặng.
 *
 * `@ValidateIf` chỉ chạy validator khi field có giá trị (`!== undefined`) ⇒ vắng mặt là hợp lệ,
 * còn có mặt — kể cả `null` — thì luôn trượt. KHÔNG kiểm bằng `'sdt' in object`: class-transformer
 * dựng sẵn MỌI key đã khai của DTO, nên `in` luôn đúng và mọi PATCH sẽ 400.
 */
export const IsAbsent =
  (message: string): PropertyDecorator =>
  (target: object, propertyKey: string | symbol): void => {
    const property = propertyKey as string;
    ValidateIf((_object: object, value: unknown) => value !== undefined)(
      target,
      propertyKey,
    );
    registerDecorator({
      name: 'isAbsent',
      target: target.constructor,
      propertyName: property,
      validator: {
        validate: () => false,
        defaultMessage: () => message,
      },
    });
  };
