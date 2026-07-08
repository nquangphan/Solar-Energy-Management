// hand-authored — web-only design-system component (Story 1.6).
import { Icon } from '../icons/Icon';

export interface ImageUploadItem {
  id: string;
  url?: string;
  name?: string;
}

export interface ImageUploadProps {
  images: ImageUploadItem[];
  onAdd: (files: File[]) => void;
  onRemove?: (id: string) => void;
  max?: number;
  accept?: string;
  multiple?: boolean;
  hint?: string;
}

/**
 * Controlled image picker (AC-5, UX-DR-25). Web picks files via
 * <input type="file" accept="image/*">, shows thumbnails, and can remove them.
 * Always optional — there is no "≥1 image required" validation.
 *
 * It emits the chosen File[] via onAdd and nothing more: it does NOT touch the
 * network, does NOT talk to R2, does NOT create signed URLs (AD-3). The
 * screen/backend owns persistence. Mobile camera/gallery capture is a Flutter
 * concern (Story 1.7).
 */
export function ImageUpload({
  images,
  onAdd,
  onRemove,
  max,
  accept = 'image/*',
  multiple = true,
  hint,
}: ImageUploadProps) {
  const full = max != null && images.length >= max;
  return (
    <div>
      <div className="thumbs">
        {images.map((img) => (
          <div className="thumb" key={img.id}>
            {img.url ? (
              <img
                src={img.url}
                alt={img.name ?? ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Icon name="ic-image" />
            )}
            {onRemove && (
              <button type="button" aria-label="Xoá ảnh" onClick={() => onRemove(img.id)}>
                <Icon name="ic-close" />
              </button>
            )}
          </div>
        ))}
        {!full && (
          <label className="thumb add">
            <input
              type="file"
              accept={accept}
              multiple={multiple}
              hidden
              onChange={(e) => {
                const files = e.target.files;
                if (files?.length) onAdd(Array.from(files));
                e.target.value = '';
              }}
            />
            <Icon name="ic-plus" />
          </label>
        )}
      </div>
      {hint && <p className="micro muted">{hint}</p>}
    </div>
  );
}
