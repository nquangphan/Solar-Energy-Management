import { ApiProperty } from '@nestjs/swagger';

/** One changed leaf of an audit record, already flattened by the backend. Cost fields are absent for a reader without `costs.view`. */
export class AuditChangeDto {
  @ApiProperty({
    description:
      'Đường dẫn tới giá trị bị đổi (status, lines[0].unitCost, [1].price); chuỗi rỗng khi dữ liệu là một giá trị đơn.',
    example: 'status',
  })
  field!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Giá trị trước dạng chuỗi (tối đa 500 ký tự); null khi không có.',
    example: 'baogia',
  })
  before!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Giá trị sau dạng chuỗi (tối đa 500 ký tự); null khi không có.',
    example: 'dachot',
  })
  after!: string | null;

  @ApiProperty({
    description:
      'Field là số tiền nguyên: client hiển thị qua bộ định dạng tiền khi giá trị là số nguyên.',
    example: false,
  })
  isMoney!: boolean;
}
