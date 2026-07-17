import { Injectable } from '@nestjs/common';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { StoragePort } from './storage.port';

/**
 * `R2StorageAdapter` — implementation `StoragePort` trên Cloudflare R2 qua S3 API (AD-3).
 *
 * Env bắt buộc LÚC DÙNG (không fail-fast ở boot — app phải chạy và test phải hermetic
 * khi vắng toàn bộ env R2): `R2_ENDPOINT` (https://<account_id>.r2.cloudflarestorage.com),
 * `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
 *
 * `requestChecksumCalculation`/`responseChecksumValidation` = `WHEN_REQUIRED` là BẮT BUỘC:
 * @aws-sdk/client-s3 ≥3.729.0 mặc định gắn CRC32 checksum mà R2 chưa hỗ trợ — thiếu cấu hình
 * này PutObject fail `Header 'x-amz-checksum-algorithm' ... not implemented`
 * (developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3).
 *
 * Bucket KHÔNG public (AD-3): mọi truy cập file đi qua backend proxy sau JWT + permission
 * guard — không presigned URL sống-ngoài-auth.
 */
@Injectable()
export class R2StorageAdapter extends StoragePort {
  /** S3Client khởi tạo LAZY ở lần dùng đầu — boot/test không đụng env R2. */
  private client: S3Client | null = null;
  private bucket = '';

  private resolveClient(): S3Client {
    if (this.client) return this.client;
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET;
    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error(
        'Thiếu cấu hình R2: cần đủ 4 biến môi trường R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET để đọc/ghi file.',
      );
    }
    this.bucket = bucket;
    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    return this.client;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    const client = this.resolveClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string): Promise<{ body: Buffer; contentType: string }> {
    const client = this.resolveClient();
    try {
      const response = await client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await response.Body!.transformToByteArray();
      return {
        body: Buffer.from(bytes),
        contentType: response.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      if (
        (error as { name?: string }).name === 'NoSuchKey' ||
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404
      ) {
        throw new AppException(ErrorCode.NOT_FOUND, 404, 'Không tìm thấy file.');
      }
      throw error;
    }
  }
}
