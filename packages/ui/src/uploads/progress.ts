export type UploadProgressHandler = (percent: number) => void;

export function sendWithProgress({
  url,
  method = "POST",
  body,
  headers,
  onProgress,
  signal,
}: {
  url: string;
  method?: string;
  body?: XMLHttpRequestBodyInit | null;
  headers?: Record<string, string>;
  onProgress?: UploadProgressHandler;
  signal?: AbortSignal;
}): Promise<{ status: number; json: Record<string, unknown>; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.responseType = "text";
    for (const [name, value] of Object.entries(headers ?? {})) {
      xhr.setRequestHeader(name, value);
    }
    const abort = () => {
      xhr.abort();
      reject(new DOMException("Upload cancelled.", "AbortError"));
    };
    if (signal) {
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener("abort", abort, { once: true });
    }
    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress(
        Math.max(
          0,
          Math.min(100, Math.round((event.loaded / event.total) * 100)),
        ),
      );
    };
    xhr.onerror = () => reject(new Error("Upload failed. Please try again."));
    xhr.onabort = () =>
      reject(new DOMException("Upload cancelled.", "AbortError"));
    xhr.onload = () => {
      const text = xhr.responseText ?? "";
      let json: Record<string, unknown> = {};
      try {
        json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        json = {};
      }
      resolve({ status: xhr.status, json, text });
    };
    xhr.send(body ?? null);
  });
}
