/**
 * Vi phạm UNIQUE/PK của Prisma (`P2002`). Nhận diện bằng `code` (duck-typing) thay vì
 * `instanceof PrismaClientKnownRequestError`: lỗi đi qua nhiều lớp adapter, và `instanceof`
 * sẽ âm thầm sai khi lỗi được tái tạo qua ranh giới module.
 *
 * Dùng chung bởi `catalog` (SKU trùng ⇒ 409) và `customers` (SĐT trùng ⇒ 409): cả hai đều
 * dịch cùng một tín hiệu DB thành cùng một hợp đồng HTTP, nên nó chỉ nên có MỘT định nghĩa.
 */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  );
}
