import { ApiProperty } from '@nestjs/swagger';
import {
  type BuocKeTiep,
  type BuocVongDoi,
} from '../domain/allowed-transition';
import { ORDER_STATUS_KEYS } from '../domain/order-status';

/**
 * Một nấc của stepper vòng đời.
 *
 * KHÔNG có nhãn tiếng Việt: nhãn đã sống ở `STATUS_LABELS` (web) / `kStatusLabels` (mobile) và
 * bị parity-guard canh byte-for-byte. Một bảng nhãn thứ ba ở backend là ba nguồn phải đồng bộ
 * bằng tay — nhãn vốn là chuyện hiển thị.
 */
export class OrderLifecycleStepDto {
  @ApiProperty({ enum: ORDER_STATUS_KEYS, example: ORDER_STATUS_KEYS[0] })
  status!: string;

  @ApiProperty({
    enum: ['done', 'current', 'upcoming'],
    description: 'Đơn đã qua bước này / đang đứng ở đây / sắp tới.',
  })
  progress!: 'done' | 'current' | 'upcoming';
}

/**
 * Response của `GET /orders/:id/lifecycle` — chuỗi bước ĐÃ GATE theo cờ phạm vi của đơn.
 *
 * Bước bị cờ chặn KHÔNG có trong mảng này (UX-DR-11: ẩn hẳn, không vẽ mờ) — client không lọc
 * gì thêm, và KHÔNG được tự suy bước từ cờ (AD-2: chuỗi bước là business logic của backend).
 */
/**
 * Một bước kế tiếp mà NGƯỜI GỌI NÀY bấm được trên đơn NÀY (Story 5.5) — đã lọc theo trạng
 * thái hiện tại × cờ phạm vi × quyền THẬT của actor.
 *
 * Client vẽ nguyên mảng và KHÔNG tự tính quyền (AD-2/AD-4): các bước đòi những key KHÁC
 * NHAU tuỳ nhánh, dựng biểu thức any-of ở client là bản sao luật thứ ba và nó sẽ lệch.
 */
export class OrderNextStepDto {
  @ApiProperty({
    description:
      'Sự kiện phải gửi lên `POST /orders/{id}/transition` để đi bước này.',
  })
  event!: string;

  @ApiProperty({
    enum: ORDER_STATUS_KEYS,
    description:
      'Đơn sẽ tới trạng thái nào — do bảng transition quyết, không do client.',
  })
  to!: string;

  @ApiProperty({
    description: 'Quyền mà bước này đòi (thông tin hiển thị/chẩn đoán).',
  })
  requires!: string;
}

export class OrderLifecycleResponseDto {
  @ApiProperty({ type: [OrderLifecycleStepDto] })
  steps!: OrderLifecycleStepDto[];

  @ApiProperty({
    type: [OrderNextStepDto],
    description:
      'Bước kế tiếp NGƯỜI GỌI bấm được. MẢNG RỖNG ⇒ nút "Chuyển trạng thái" ẩn hẳn, không vẽ xám (UX-DR-22).',
  })
  nextSteps!: OrderNextStepDto[];

  @ApiProperty({
    description:
      'Người gọi này huỷ được đơn này không (Story 5.7) — tính từ bảng transition × trạng thái hiện tại × quyền THẬT. `false` ⇒ ẩn HẲN nút "Huỷ đơn", không vẽ xám (UX-DR-22). Client KHÔNG suy được cờ này từ `nextSteps`: `huy` không thuộc lane thủ công nên không bao giờ có mặt ở đó.',
  })
  canCancel!: boolean;
}

/** Maps the lifecycle computed by the service to the contract — fields listed, no spread. */
export function toOrderLifecycleResponseDto(view: {
  readonly buoc: readonly BuocVongDoi[];
  readonly buocKeTiep: readonly BuocKeTiep[];
  readonly coTheHuy: boolean;
}): OrderLifecycleResponseDto {
  return {
    steps: view.buoc.map((step) => ({
      status: step.status,
      progress: step.trangThai,
    })),
    nextSteps: view.buocKeTiep.map((step) => ({
      event: step.event,
      to: step.to,
      requires: step.requires,
    })),
    canCancel: view.coTheHuy,
  };
}
