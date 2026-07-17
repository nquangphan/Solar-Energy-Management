import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';

/**
 * R2StorageAdapter (AD-3) — hermetic, mock toàn bộ @aws-sdk/client-s3 (không mạng, không R2).
 * Chốt các hành vi hạ tầng dễ vỡ thầm lặng:
 *  - LAZY init: khởi tạo adapter + boot app KHÔNG cần env R2; thiếu env chỉ lỗi LÚC DÙNG
 *    với message liệt kê đủ 4 biến.
 *  - Checksum `WHEN_REQUIRED` ×2 trên S3Client: gotcha bắt buộc — SDK ≥3.729.0 mặc định
 *    CRC32 làm R2 từ chối PutObject; gỡ config này prod vỡ mà không suite nào đỏ nếu
 *    thiếu test này.
 *  - `NoSuchKey`/HTTP 404 từ R2 → AppException NOT_FOUND (domain error, không rò lỗi SDK).
 */

const mockSend = jest.fn();
const mockS3Configs: Record<string, unknown>[] = [];

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    constructor(config: Record<string, unknown>) {
      mockS3Configs.push(config);
    }
    send = mockSend;
  },
  PutObjectCommand: class {
    constructor(public readonly input: Record<string, unknown>) {}
  },
  GetObjectCommand: class {
    constructor(public readonly input: Record<string, unknown>) {}
  },
}));

// Import SAU jest.mock — adapter nhận class giả ở trên.
// eslint-disable-next-line import/first
import { R2StorageAdapter } from '../src/storage/r2-storage.adapter';

const R2_ENV_KEYS = [
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
] as const;

describe('R2StorageAdapter (unit, hermetic)', () => {
  const envBackup: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const key of R2_ENV_KEYS) envBackup[key] = process.env[key];
  });

  afterAll(() => {
    for (const key of R2_ENV_KEYS) {
      if (envBackup[key] === undefined) delete process.env[key];
      else process.env[key] = envBackup[key];
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockS3Configs.length = 0;
    for (const key of R2_ENV_KEYS) delete process.env[key];
  });

  function coDuEnv(): void {
    process.env.R2_ENDPOINT = 'https://tai-khoan.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'khoa-truy-cap';
    process.env.R2_SECRET_ACCESS_KEY = 'khoa-bi-mat';
    process.env.R2_BUCKET = 'bucket-noi-bo';
  }

  it('LAZY init: khởi tạo adapter KHÔNG cần env R2 — không throw, không dựng S3Client', () => {
    expect(() => new R2StorageAdapter()).not.toThrow();
    expect(mockS3Configs).toHaveLength(0);
  });

  it('thiếu env lúc DÙNG → Error message tiếng Việt liệt kê đủ 4 biến, không gọi SDK', async () => {
    const adapter = new R2StorageAdapter();
    await expect(
      adapter.putObject('quotes/x/bao-gia.png', Buffer.from('x'), 'image/png'),
    ).rejects.toThrow(
      'Thiếu cấu hình R2: cần đủ 4 biến môi trường R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET để đọc/ghi file.',
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('S3Client config: region auto + endpoint env + checksum WHEN_REQUIRED ×2 (gotcha R2 bắt buộc)', async () => {
    coDuEnv();
    mockSend.mockResolvedValue({});
    const adapter = new R2StorageAdapter();
    await adapter.putObject('quotes/don-1/bao-gia.png', Buffer.from('anh'), 'image/png');

    expect(mockS3Configs).toHaveLength(1);
    expect(mockS3Configs[0]).toEqual({
      region: 'auto',
      endpoint: 'https://tai-khoan.r2.cloudflarestorage.com',
      credentials: {
        accessKeyId: 'khoa-truy-cap',
        secretAccessKey: 'khoa-bi-mat',
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  });

  it('putObject gửi đúng Bucket/Key/Body/ContentType; client cache — 2 lần dùng vẫn MỘT S3Client', async () => {
    coDuEnv();
    mockSend.mockResolvedValue({});
    const adapter = new R2StorageAdapter();
    const anh = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await adapter.putObject('quotes/don-1/bao-gia.png', anh, 'image/png');
    await adapter.putObject('quotes/don-1/bao-gia.pdf', Buffer.from('%PDF'), 'application/pdf');

    const lenh1 = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(lenh1.input).toEqual({
      Bucket: 'bucket-noi-bo',
      Key: 'quotes/don-1/bao-gia.png',
      Body: anh,
      ContentType: 'image/png',
    });
    const lenh2 = mockSend.mock.calls[1][0] as { input: Record<string, unknown> };
    expect(lenh2.input.ContentType).toBe('application/pdf');
    expect(mockS3Configs).toHaveLength(1);
  });

  it('getObject thành công: trả Buffer + ContentType; SDK không trả type → octet-stream', async () => {
    coDuEnv();
    mockSend.mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
      ContentType: undefined,
    });
    const adapter = new R2StorageAdapter();
    const ketQua = await adapter.getObject('quotes/don-1/bao-gia.png');

    expect(Buffer.isBuffer(ketQua.body)).toBe(true);
    expect([...ketQua.body]).toEqual([1, 2, 3]);
    expect(ketQua.contentType).toBe('application/octet-stream');
    const lenh = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(lenh.input).toEqual({
      Bucket: 'bucket-noi-bo',
      Key: 'quotes/don-1/bao-gia.png',
    });
  });

  it('getObject NoSuchKey → AppException NOT_FOUND 404 (domain error, không rò lỗi SDK)', async () => {
    coDuEnv();
    mockSend.mockRejectedValue(
      Object.assign(new Error('The specified key does not exist.'), {
        name: 'NoSuchKey',
      }),
    );
    const adapter = new R2StorageAdapter();
    const loi = (await adapter
      .getObject('quotes/don-ma/bao-gia.png')
      .catch((err: unknown) => err)) as AppException;

    expect(loi).toBeInstanceOf(AppException);
    expect(loi.errorCode).toBe(ErrorCode.NOT_FOUND);
    expect(loi.getStatus()).toBe(404);
  });

  it('getObject lỗi HTTP 404 không tên NoSuchKey → vẫn NOT_FOUND; lỗi khác → propagate NGUYÊN', async () => {
    coDuEnv();
    const adapter = new R2StorageAdapter();

    mockSend.mockRejectedValueOnce(
      Object.assign(new Error('not found'), {
        name: 'UnknownError',
        $metadata: { httpStatusCode: 404 },
      }),
    );
    const loi404 = (await adapter
      .getObject('quotes/don-1/bao-gia.pdf')
      .catch((err: unknown) => err)) as AppException;
    expect(loi404).toBeInstanceOf(AppException);
    expect(loi404.getStatus()).toBe(404);

    mockSend.mockRejectedValueOnce(
      Object.assign(new Error('R2 sập'), {
        name: 'InternalError',
        $metadata: { httpStatusCode: 500 },
      }),
    );
    await expect(adapter.getObject('quotes/don-1/bao-gia.pdf')).rejects.toThrow(
      'R2 sập',
    );
  });
});
