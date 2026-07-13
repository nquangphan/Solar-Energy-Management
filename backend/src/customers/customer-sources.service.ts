import { Injectable } from '@nestjs/common';
import type { CustomerSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Danh mục Nguồn khách — CHỈ ĐỌC ở story này (Story 3.5 làm CRUD + màn cấu hình, gate
 * `settings.manage`, và KHÔNG tạo lại bảng/migration này).
 *
 * Endpoint đọc tồn tại vì `Customer.sourceId` là FK bắt buộc: form khách phải có cái mà chọn.
 * Mặc định chỉ trả nguồn còn `active` — nguồn đã ngừng dùng không nên xuất hiện trong dropdown
 * của khách MỚI, dù khách CŨ vẫn trỏ vào nó (nên bảng không xoá cứng dòng nào).
 */
@Injectable()
export class CustomerSourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive: boolean): Promise<CustomerSource[]> {
    return await this.prisma.customerSource.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
