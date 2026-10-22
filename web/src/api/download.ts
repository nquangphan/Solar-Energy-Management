// hand-authored — naming a file downloaded through the transport (Story 10.5).
//
// PDFs and photos come back as bytes over the authenticated client; the screen opens
// them with an object URL or the share sheet, never with a public link (AD-3). The
// backend names a PDF in `Content-Disposition: attachment; filename="<ASCII>"`
// (contract and invoice numbers are ASCII by construction). Cross-origin, the header
// is only readable because the backend's CORS exposes it.

/** The quoted `filename` of a `Content-Disposition` header, or `fallback` when absent or unreadable. */
export function fileNameOf(response: Response, fallback: string): string {
  const header = response.headers.get('content-disposition') ?? '';
  return /filename="([^"]+)"/.exec(header)?.[1] ?? fallback;
}

/** Wraps a downloaded blob into a `File` named by the response, keeping its media type. */
export function downloadedFile(blob: Blob, response: Response, fallbackName: string): File {
  return new File([blob], fileNameOf(response, fallbackName), { type: blob.type });
}
