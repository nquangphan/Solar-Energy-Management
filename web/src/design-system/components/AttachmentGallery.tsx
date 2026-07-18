// hand-authored — web design-system component (Story 5.6, mirror Flutter
// mobile/lib/design_system/components/attachment_gallery.dart).
import { Icon } from '../icons/Icon';

export interface AttachmentGalleryItem {
  id: string;
  fileName: string;
  nguoiTaiLen: string;
  createdAt: string;
  /** Both step coordinates null ⇒ supplementary photo. */
  statusTo?: string | null;
  /** Step badge text the SCREEN built from the status label table. */
  buocLabel?: string;
  /** Object URL the SCREEN created from the bytes it fetched. */
  previewSrc?: string;
  coTheXoa: boolean;
}

export interface AttachmentGalleryProps {
  items: AttachmentGalleryItem[];
  onDelete: (id: string) => void;
  emptyLabel: string;
}

/**
 * READ-ONLY gallery for photos already stored on the server (Story 5.6, FR-24).
 *
 * It does NOT touch the network — no fetch, no storage SDK, no signed URLs
 * (AD-3). The SCREEN loads bytes through the port's proxy call and hands each
 * item a ready `previewSrc`; this component only lays them out. That is why it
 * is a separate component from ImageUpload, which is a picker for LOCAL files
 * the user just chose and carries no uploader/timestamp metadata.
 *
 * Deleting goes through the screen's confirm dialog — this component only
 * reports the intent through `onDelete`. The delete button is HIDDEN outright
 * when `coTheXoa` is false, never greyed out (UX-DR-22): a disabled control
 * still advertises a capability the caller does not have.
 */
export function AttachmentGallery({
  items,
  onDelete,
  emptyLabel,
}: AttachmentGalleryProps) {
  if (items.length === 0) {
    return <p className="muted">{emptyLabel}</p>;
  }
  return (
    <div className="thumbs attachment-gallery">
      {items.map((item) => (
        <figure className="attachment-item" key={item.id}>
          <div className="thumb">
            {item.previewSrc ? (
              <img
                src={item.previewSrc}
                alt={item.fileName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Icon name="ic-image" />
            )}
            {item.coTheXoa && (
              <button
                type="button"
                aria-label="Xoá ảnh"
                className="attachment-delete"
                onClick={() => onDelete(item.id)}
              >
                <Icon name="ic-trash" />
              </button>
            )}
          </div>
          <figcaption className="micro muted">
            <span className="attachment-badge">
              {item.statusTo == null ? 'Bổ sung' : (item.buocLabel ?? 'Bổ sung')}
            </span>
            <span className="attachment-meta">{item.nguoiTaiLen}</span>
            <span className="attachment-meta">{item.createdAt}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
