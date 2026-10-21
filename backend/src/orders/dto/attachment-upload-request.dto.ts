import { ApiProperty } from '@nestjs/swagger';

/**
 * `multipart/form-data` form of `POST /orders/:id/attachments` — only so OpenAPI names the file
 * field the client must send. Multer puts files in `req.files`, not in the body, so this class
 * carries no validator and the handler never reads it.
 */
export class AttachmentUploadRequestDto {
  // Required on the contract: the handler refuses an upload without any file (400 `minCount`).
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description:
      'Ảnh bổ sung (JPEG/PNG/WebP). Thiếu hoặc rỗng ⇒ 400; ngưỡng số ảnh/kích thước do backend kiểm.',
  })
  files!: unknown[];
}
