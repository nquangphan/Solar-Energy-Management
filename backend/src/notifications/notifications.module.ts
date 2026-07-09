import { Module } from '@nestjs/common';
import { NotificationDispatcher } from './notification-dispatcher';

/**
 * NotificationsModule — module gửi push DUY NHẤT (AD-14). Bản đầu chỉ có
 * `NotificationDispatcher` no-op/log, tự đăng ký vào `EventBus` (@Global) khi init.
 *
 * Ranh giới Epic 9 (ĐỪNG làm ở đây): KHÔNG `firebase-admin`, KHÔNG entity
 * `DeviceToken`/`Notification`, KHÔNG resolver người-nhận-theo-quyền, KHÔNG job scheduler.
 * 2.7 CHỈ chừa seam để Epic 9 thay implementation dispatcher.
 *
 * KHÔNG export — producer KHÔNG inject dispatcher trực tiếp (source-guard AD-18); publish
 * qua `EventBus`.
 */
@Module({
  providers: [NotificationDispatcher],
})
export class NotificationsModule {}
