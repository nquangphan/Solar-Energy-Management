// hand-authored — web-only design-system util (Story 1.6).

export interface ShareFilesOptions {
  files?: File[];
  title?: string;
  text?: string;
  fallbackDownload?: boolean;
}

export type ShareResult = 'shared' | 'downloaded' | 'unsupported';

/**
 * Web share (AC-4, UX-DR-21). Prefers the native Web Share API with files
 * (image before PDF — the caller orders `files` as [image, pdf]); when file
 * share is unsupported, falls back to downloading the first file so web stays
 * equivalent to native share.
 *
 * This util never uploads anywhere — it shares/downloads a File the caller
 * already holds. AbortError (the user cancelling the OS share sheet) is swallowed.
 */
export async function shareFiles(opts: ShareFilesOptions): Promise<ShareResult> {
  const { files, title, text, fallbackDownload = true } = opts;

  if (files?.length && navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title, text });
      return 'shared';
    } catch (err) {
      // User dismissed the OS share sheet — not an error.
      if (err instanceof Error && err.name === 'AbortError') return 'shared';
      throw err;
    }
  }

  if (fallbackDownload && files?.length) {
    const file = files[0];
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    // The anchor must be in the document for a programmatic download click in
    // some engines, and the object URL must outlive the click — revoking it in
    // the same tick cancels the download in Safari/Firefox. Defer cleanup.
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 0);
    return 'downloaded';
  }

  return 'unsupported';
}
