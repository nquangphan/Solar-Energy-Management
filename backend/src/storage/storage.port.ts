/**
 * `StoragePort` — PORT DUY NHẤT đọc/ghi binary object storage (AD-3).
 *
 * Abstract class kiêm DI token (khuôn `events/event-bus.ts`): service nghiệp vụ inject
 * `StoragePort` và CHỈ gọi put/get theo key; KHÔNG biết R2/S3/filesystem nào đứng sau.
 * DB chỉ giữ key + metadata — bytes sống sau port này. Đổi nhà cung cấp storage
 * KHÔNG đụng service nghiệp vụ.
 *
 * Implementation mặc định: `R2StorageAdapter` (Cloudflare R2 qua S3 API).
 */
export abstract class StoragePort {
  /** Ghi object (đè nếu key đã tồn tại — caller chủ động chọn key deterministic). */
  abstract putObject(key: string, body: Buffer, contentType: string): Promise<void>;

  /** Đọc object; key không tồn tại → ném NotFound domain error (envelope 404). */
  abstract getObject(key: string): Promise<{ body: Buffer; contentType: string }>;

  /**
   * Xoá object. Caller gọi SAU khi hàng DB trỏ tới key đã bị xoá và commit — bytes mồ côi
   * (xoá DB xong, xoá R2 hỏng) vô hình với mọi endpoint, còn thứ tự ngược lại để hàng DB
   * trỏ vào bytes không tồn tại và làm vỡ đường đọc.
   */
  abstract deleteObject(key: string): Promise<void>;
}
