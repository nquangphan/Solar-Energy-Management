import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ThayDoiBanUpdate } from '../domain/version-diff';
import type { OrderVersionRow } from '../orders.service';

/** Đổi số lượng của MỘT dòng giữa hai bản. */
export class QtyChangeDto {
  @ApiProperty({ description: 'Tên dòng ở bản mới.' })
  name!: string;

  @ApiProperty({ description: 'Số lượng ở bản trước.' })
  from!: number;

  @ApiProperty({ description: 'Số lượng ở bản này.' })
  to!: number;
}

/**
 * "Đổi gì" so với bản liền trước — CHỈ về dòng và số lượng.
 *
 * KHÔNG so tiền/đơn giá: trước Chốt giá là live-resolve từ danh mục, nên so giá sẽ báo "đổi"
 * cho một bản không ai đụng vào.
 */
export class VersionChangesDto {
  @ApiProperty({ type: [String], description: 'Tên các dòng mới thêm.' })
  added!: string[];

  @ApiProperty({ type: [String], description: 'Tên các dòng bị xoá.' })
  removed!: string[];

  @ApiProperty({ type: [QtyChangeDto] })
  qtyChanged!: QtyChangeDto[];
}

/**
 * Một bản update trong lịch sử đơn (FR-6).
 *
 * `isCurrent` phân giải qua `Order.currentVersionId` — KHÔNG suy bằng `versionNo` lớn nhất
 * hay timestamp (AD-6 cấm tường minh: con trỏ có thể trỏ bản không phải bản mới nhất).
 *
 * `createdByAccountId`/`createdByDisplayName` null với bản tạo trước khi cột actor tồn tại —
 * UI hiện `—`, KHÔNG bịa tên.
 */
export class OrderVersionItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Số thứ tự bản, bắt đầu từ 1.', example: 1 })
  versionNo!: number;

  @ApiProperty({ description: 'Bản đang hiệu lực (theo currentVersionId).' })
  isCurrent!: boolean;

  @ApiProperty({ description: 'ISO-8601 UTC.' })
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'Thời điểm bản này được Chốt; null nếu chưa chốt.',
    nullable: true,
  })
  confirmedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  createdByAccountId!: string | null;

  @ApiPropertyOptional({
    description: 'Tên hiển thị người tạo bản; null với bản cũ không có actor.',
    nullable: true,
  })
  createdByDisplayName!: string | null;

  @ApiProperty({ description: 'Số dòng của chính bản này.' })
  lineCount!: number;

  @ApiProperty({ type: VersionChangesDto })
  changes!: VersionChangesDto;
}

export function toQtyChangeDto(change: {
  ten: string;
  tu: number;
  den: number;
}): QtyChangeDto {
  return { name: change.ten, from: change.tu, to: change.den };
}

export function toVersionChangesDto(
  changes: ThayDoiBanUpdate,
): VersionChangesDto {
  return {
    added: [...changes.them],
    removed: [...changes.xoa],
    qtyChanged: changes.doiSoLuong.map(toQtyChangeDto),
  };
}

/** Maps one history row of the service to the contract — fields listed, no spread. */
export function toOrderVersionItemDto(
  row: OrderVersionRow,
): OrderVersionItemDto {
  return {
    id: row.id,
    versionNo: row.versionNo,
    isCurrent: row.laBanHienLuc,
    createdAt: row.createdAt,
    confirmedAt: row.chotAt,
    createdByAccountId: row.createdByAccountId,
    createdByDisplayName: row.createdByDisplayName,
    lineCount: row.soDong,
    changes: toVersionChangesDto(row.thayDoi),
  };
}
