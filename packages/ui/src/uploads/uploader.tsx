/* eslint-disable @next/next/no-img-element -- Local blob and on-demand storage previews. */
"use client";
import { useId, useRef, useState } from "react";
import {
  IMAGE_ACCEPT,
  IMAGE_MAX_BYTES,
  processImageForUpload,
  validateUploadFile,
} from "./process";

export type UploadItemStatus = "uploading" | "ready" | "error";

export type MediaUploadResult = {
  key: string;
  displayUrl: string;
};

export type UploadItem = {
  id: string;
  name: string;
  previewUrl: string;
  progress: number;
  status: UploadItemStatus;
  error?: string;
  key?: string;
  displayUrl?: string;
  file?: File;
};

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function MediaUploader({
  id,
  label = "Upload images",
  hint = "JPG, PNG or WebP · up to 10 MB",
  accept = IMAGE_ACCEPT,
  maxBytes = IMAGE_MAX_BYTES,
  maxFiles = 1,
  takenCount = 0,
  disabled = false,
  className,
  retainReady = true,
  value = [],
  uploadFile,
  onRemove,
}: {
  id?: string;
  label?: string;
  hint?: string;
  accept?: string;
  maxBytes?: number;
  maxFiles?: number;
  takenCount?: number;
  disabled?: boolean;
  className?: string;
  retainReady?: boolean;
  value?: MediaUploadResult[];
  uploadFile: (
    file: File,
    context: { onProgress: (percent: number) => void; signal: AbortSignal },
  ) => Promise<MediaUploadResult>;
  onRemove?: (item: UploadItem) => void | Promise<void>;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const [items, setItems] = useState<UploadItem[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inFlight = items.filter((item) => item.status !== "error").length;
  const remaining =
    maxFiles === 1
      ? disabled
        ? 0
        : 1
      : Math.max(0, maxFiles - takenCount - inFlight);
  const busy = disabled || remaining === 0;

  function patch(id: string, next: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...next } : item)),
    );
  }

  async function startUpload(original: File, existingId?: string) {
    const check = validateUploadFile(original, { maxBytes });
    if (!check.ok) {
      setError(check.error ?? "Choose a supported image.");
      return;
    }
    if (!existingId && remaining <= 0) {
      setError(`You can add up to ${maxFiles} images.`);
      return;
    }
    setError("");
    let file = original;
    try {
      file = await processImageForUpload(original);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Choose a JPG, PNG or WebP image under 10 MB.",
      );
      return;
    }
    const itemId = existingId ?? crypto.randomUUID();
    const previewUrl = URL.createObjectURL(file);
    const next: UploadItem = {
      id: itemId,
      name: file.name,
      previewUrl,
      progress: 0,
      status: "uploading",
      file,
    };
    setItems((current) => {
      if (existingId) {
        const previous = current.find((item) => item.id === existingId);
        if (previous?.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previous.previewUrl);
        }
        return current.map((item) => (item.id === existingId ? next : item));
      }
      if (maxFiles === 1) {
        for (const item of current) {
          controllers.current.get(item.id)?.abort();
          if (item.previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(item.previewUrl);
          }
        }
        return [next];
      }
      return [...current, next];
    });
    const controller = new AbortController();
    controllers.current.set(itemId, controller);
    try {
      const result = await uploadFile(file, {
        signal: controller.signal,
        onProgress: (percent) => patch(itemId, { progress: percent }),
      });
      if (retainReady) {
        patch(itemId, {
          status: "ready",
          progress: 100,
          key: result.key,
          displayUrl: result.displayUrl,
          error: undefined,
        });
      } else {
        if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
        setItems((current) => current.filter((item) => item.id !== itemId));
      }
    } catch (caught) {
      if (isAbortError(caught)) {
        if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
        setItems((current) => current.filter((item) => item.id !== itemId));
        return;
      }
      patch(itemId, {
        status: "error",
        error:
          caught instanceof Error
            ? caught.message
            : "Upload failed. Please retry.",
      });
    } finally {
      controllers.current.delete(itemId);
    }
  }

  function cancel(item: UploadItem) {
    controllers.current.get(item.id)?.abort();
    if (item.previewUrl.startsWith("blob:"))
      URL.revokeObjectURL(item.previewUrl);
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    setConfirmId(null);
  }

  async function remove(item: UploadItem) {
    if (item.status === "uploading") {
      cancel(item);
      return;
    }
    if (confirmId !== item.id) {
      setConfirmId(item.id);
      return;
    }
    setConfirmId(null);
    try {
      await onRemove?.(item);
      if (item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (caught) {
      patch(item.id, {
        status: "error",
        error:
          caught instanceof Error
            ? caught.message
            : "Could not remove this image.",
      });
    }
  }

  const shownValue = retainReady
    ? value.filter((entry) => !items.some((item) => item.key === entry.key))
    : [];

  return (
    <div className="media-uploader">
      <label
        className={`media-uploader-drop ${className ?? ""}`.trim()}
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (busy) return;
          const files = [...event.dataTransfer.files];
          if (maxFiles === 1) {
            if (files[0]) void startUpload(files[0]);
            return;
          }
          for (const file of files.slice(0, remaining)) void startUpload(file);
        }}
      >
        <span aria-hidden="true">↑</span>
        <strong>{label}</strong>
        <small>{hint}</small>
        <input
          ref={inputRef}
          id={inputId}
          className="sr-only"
          type="file"
          accept={accept}
          multiple={maxFiles > 1}
          disabled={busy}
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            if (maxFiles === 1) {
              if (files[0]) void startUpload(files[0]);
              return;
            }
            for (const file of files.slice(0, remaining))
              void startUpload(file);
          }}
        />
      </label>
      {error && (
        <p className="media-uploader-error" role="alert">
          {error}
        </p>
      )}
      <ul className="media-uploader-list">
        {shownValue.map((entry) => (
          <li key={entry.key} className="media-uploader-item">
            <img src={entry.displayUrl} alt="" />
            <div>
              <p>Uploaded</p>
              <div className="media-uploader-actions">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    void remove({
                      id: entry.key,
                      name: entry.key,
                      previewUrl: entry.displayUrl,
                      progress: 100,
                      status: "ready",
                      key: entry.key,
                      displayUrl: entry.displayUrl,
                    })
                  }
                >
                  {confirmId === entry.key ? "Confirm remove" : "Remove"}
                </button>
                {confirmId === entry.key && (
                  <button type="button" onClick={() => setConfirmId(null)}>
                    Keep
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
        {items.map((item) => (
          <li key={item.id} className="media-uploader-item">
            <img src={item.displayUrl || item.previewUrl} alt="" />
            <div>
              {item.status === "uploading" && (
                <progress
                  aria-label={`Uploading ${item.name}`}
                  max={100}
                  value={item.progress}
                />
              )}
              {item.status === "ready" && <p>Uploaded</p>}
              {item.status === "error" && (
                <p className="media-uploader-error" role="alert">
                  {item.error}
                </p>
              )}
              <p>{item.name}</p>
              <div className="media-uploader-actions">
                {item.status === "uploading" && (
                  <button type="button" onClick={() => cancel(item)}>
                    Cancel
                  </button>
                )}
                {item.status === "error" && item.file && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void startUpload(item.file!, item.id)}
                  >
                    Retry
                  </button>
                )}
                {item.status !== "uploading" && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void remove(item)}
                  >
                    {confirmId === item.id ? "Confirm remove" : "Remove"}
                  </button>
                )}
                {confirmId === item.id && (
                  <button type="button" onClick={() => setConfirmId(null)}>
                    Keep
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
