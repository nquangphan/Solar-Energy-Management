import { ApiProperty } from '@nestjs/swagger';

/**
 * The seller (company legal entity) copied onto the invoice at issue time. `''` = the field was
 * not configured then — clients print "Chưa cấu hình". Never re-read from the settings.
 */
export class InvoiceSellerDto {
  @ApiProperty({
    description: 'Tên pháp nhân bên bán lúc lập; rỗng = chưa cấu hình.',
  })
  legalName!: string;

  @ApiProperty({ description: 'MST bên bán lúc lập; rỗng = chưa cấu hình.' })
  taxCode!: string;

  @ApiProperty({
    description: 'Địa chỉ bên bán lúc lập; rỗng = chưa cấu hình.',
  })
  address!: string;

  @ApiProperty({ description: 'Người đại diện lúc lập; rỗng = chưa cấu hình.' })
  representative!: string;

  @ApiProperty({
    description: 'Chức danh người đại diện lúc lập; rỗng = chưa cấu hình.',
  })
  representativeTitle!: string;

  @ApiProperty({
    description: 'Điện thoại bên bán lúc lập; rỗng = chưa cấu hình.',
  })
  phone!: string;

  @ApiProperty({
    description: 'Tài khoản ngân hàng bên bán lúc lập; rỗng = chưa cấu hình.',
  })
  bankAccount!: string;
}
