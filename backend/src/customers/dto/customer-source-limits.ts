/**
 * Trần trên của `sortOrder` = trần của `int4` Postgres (cột `sortOrder` là `Int`).
 *
 * Không có trần này thì `sortOrder: 9999999999` đi lọt `@Min(0)`, xuống tới Postgres, và ném
 * P2020 ("value out of range") — một mã lỗi mà `translateWriteError()` không dịch, nên nó nổi
 * lên thành **500** thay vì **400**. Giá trị nằm ở đây, dùng chung cho cả DTO create lẫn update:
 * hai cửa vào cùng một cột thì phải cùng một trần.
 */
export const SORT_ORDER_MAX = 2147483647;
