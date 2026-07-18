import { StoragePort } from '../../src/storage/storage.port';

/**
 * `StoragePort` giả GHI LẠI mọi lần put — dùng chung cho mọi test dựng `OrdersService` bằng
 * `new` (Story 5.5 thêm storage làm dependency thứ ba cho lane chuyển trạng thái thủ công).
 *
 * Object nằm trong `Map` nên test khẳng định được CẢ hai chiều: đã upload đúng key/bytes
 * chưa, và đọc lại có ra đúng bytes đó không. Test nào không đụng ảnh thì cứ bỏ qua nó.
 */
export interface FakeStorage extends StoragePort {
  readonly objects: Map<string, { body: Buffer; contentType: string }>;
}

export function fakeStorage(): FakeStorage {
  const objects = new Map<string, { body: Buffer; contentType: string }>();
  return {
    objects,
    putObject: async (key, body, contentType) => {
      objects.set(key, { body, contentType });
    },
    getObject: async (key) => {
      const found = objects.get(key);
      if (found === undefined) throw new Error(`Không có object: ${key}`);
      return found;
    },
    deleteObject: async (key) => {
      objects.delete(key);
    },
  };
}
