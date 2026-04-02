"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { apiClient } from "@/lib/api-client";
import Modal from "@/components/ui/Modal";

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  folder: string;
  label: string;
  aspectRatio?: string;
  enableEditor?: boolean;
  editorTitle?: string;
  outputWidth?: number;
  outputHeight?: number;
  multiple?: boolean;
  maxFiles?: number;
}

type Size = {
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

const PREVIEW_WIDTH = 240;
const EDITOR_FRAME_WIDTH = 320;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ZOOM_MULTIPLIER = 4;

const COPY = {
  invalidType: "\uC774\uBBF8\uC9C0 \uD30C\uC77C\uB9CC \uC5C5\uB85C\uB4DC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
  fileTooLarge: "\uD30C\uC77C \uD06C\uAE30\uB294 5MB \uC774\uD558\uC5EC\uC57C \uD569\uB2C8\uB2E4.",
  imageLoadFailed: "\uC774\uBBF8\uC9C0\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
  blobCreateFailed:
    "\uD3B8\uC9D1\uD55C \uC774\uBBF8\uC9C0\uB97C \uB9CC\uB4E4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
  defaultEditorTitle: "\uC774\uBBF8\uC9C0 \uD3B8\uC9D1",
  loadEditorFailed:
    "\uC774\uBBF8\uC9C0\uB97C \uD3B8\uC9D1\uAE30\uC5D0 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
  uploadFailed:
    "\uC774\uBBF8\uC9C0 \uC5C5\uB85C\uB4DC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.",
  editStartFailed:
    "\uC774\uBBF8\uC9C0 \uD3B8\uC9D1\uC744 \uC2DC\uC791\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
  editFailed:
    "\uC774\uBBF8\uC9C0 \uD3B8\uC9D1 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.",
  removeImage: "\uC774\uBBF8\uC9C0 \uC81C\uAC70",
  uploading: "\uC5C5\uB85C\uB4DC \uC911...",
  uploadPrompt:
    "\uD074\uB9AD\uD558\uAC70\uB098 \uB4DC\uB798\uADF8\uD574\uC11C \uC774\uBBF8\uC9C0\uB97C \uC5C5\uB85C\uB4DC\uD558\uC138\uC694",
  uploadPromptMultiple:
    "\uD074\uB9AD\uD558\uAC70\uB098 \uB4DC\uB798\uADF8\uD574\uC11C \uC5EC\uB7EC \uC7A5\uC758 \uC774\uBBF8\uC9C0\uB97C \uC62C\uB9AC\uC138\uC694",
  uploadHint: "JPG, PNG, WebP, GIF (\uCD5C\uB300 5MB)",
  editHint:
    "\uC5C5\uB85C\uB4DC \uC804\uC5D0 \uBE44\uC728\uC5D0 \uB9DE\uAC8C \uC790\uB97C \uC218 \uC788\uC5B4\uC694",
  editHintMultiple:
    "\uD55C \uC7A5\uC740 \uD3B8\uC9D1 \uD6C4 \uC5C5\uB85C\uB4DC\uD560 \uC218 \uC788\uACE0, \uC5EC\uB7EC \uC7A5\uC740 \uBC14\uB85C \uC62C\uB77C\uAC11\uB2C8\uB2E4",
  cancel: "\uCDE8\uC18C",
  saveEdited: "\uC798\uB77C\uC11C \uC5C5\uB85C\uB4DC",
  saving: "\uC800\uC7A5 \uC911...",
  editorHelpPrefix:
    "\uB4DC\uB798\uADF8\uB85C \uC704\uCE58\uB97C \uB9DE\uCD94\uACE0 \uC2AC\uB77C\uC774\uB354\uB85C \uD655\uB300/\uCD95\uC18C\uD558\uC138\uC694. \uC800\uC7A5\uD558\uBA74",
  editorHelpSuffix:
    "px \uBE44\uC728\uB85C \uC5C5\uB85C\uB4DC\uB429\uB2C8\uB2E4.",
  loadingImage: "\uC774\uBBF8\uC9C0\uB97C \uBD88\uB7EC\uC624\uB294 \uC911...",
  zoom: "\uD655\uB300/\uCD95\uC18C",
  maxFilesExceeded: "\uD55C \uBC88\uC5D0 \uCD5C\uB300",
  maxFilesExceededSuffix:
    "\uC7A5\uAE4C\uC9C0 \uC120\uD0DD\uD560 \uC218 \uC788\uC5B4\uC694. \uC55E\uC5D0\uC11C\uBD80\uD130 \uD574\uB2F9 \uAC1C\uC218\uB9CC \uC62C\uB9BD\uB2C8\uB2E4.",
} as const;

function parseAspectRatio(aspectRatio: string) {
  const [width, height] = aspectRatio.split("/").map((value) => Number(value));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 1, height: 1 };
  }
  return { width, height };
}

function getPreviewSize(aspectRatio: string) {
  const ratio = parseAspectRatio(aspectRatio);
  return {
    width: PREVIEW_WIDTH,
    height: Math.max(1, Math.round(PREVIEW_WIDTH * (ratio.height / ratio.width))),
  };
}

function getEditorFrameSize(aspectRatio: string) {
  const ratio = parseAspectRatio(aspectRatio);
  return {
    width: EDITOR_FRAME_WIDTH,
    height: Math.max(
      1,
      Math.round(EDITOR_FRAME_WIDTH * (ratio.height / ratio.width)),
    ),
  };
}

function getOutputSize(
  aspectRatio: string,
  outputWidth?: number,
  outputHeight?: number,
) {
  if (outputWidth && outputHeight) {
    return { width: outputWidth, height: outputHeight };
  }

  const ratio = parseAspectRatio(aspectRatio);
  const width = outputWidth ?? 1200;
  return {
    width,
    height: outputHeight ?? Math.max(1, Math.round(width * (ratio.height / ratio.width))),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampPosition(position: Point, imageSize: Size, frameSize: Size): Point {
  const minX = Math.min(0, frameSize.width - imageSize.width);
  const maxX = 0;
  const minY = Math.min(0, frameSize.height - imageSize.height);
  const maxY = 0;

  return {
    x: clamp(position.x, minX, maxX),
    y: clamp(position.y, minY, maxY),
  };
}

function getCenteredPosition(imageSize: Size, frameSize: Size): Point {
  return clampPosition(
    {
      x: (frameSize.width - imageSize.width) / 2,
      y: (frameSize.height - imageSize.height) / 2,
    },
    imageSize,
    frameSize,
  );
}

function replaceFileExtension(fileName: string, nextExtension: string) {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) {
    return `${fileName}.${nextExtension}`;
  }
  return `${fileName.slice(0, dotIndex)}.${nextExtension}`;
}

function validateFile(file: File) {
  if (!file.type.startsWith("image/")) {
    return COPY.invalidType;
  }
  if (file.size > MAX_FILE_SIZE) {
    return COPY.fileTooLarge;
  }
  return null;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(COPY.imageLoadFailed));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error(COPY.blobCreateFailed));
    }, type, quality);
  });
}

export function ImageUpload({
  value,
  onChange,
  folder,
  label,
  aspectRatio = "1/1",
  enableEditor = false,
  editorTitle = COPY.defaultEditorTitle,
  outputWidth,
  outputHeight,
  multiple = false,
  maxFiles,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startPointer: Point;
    startPosition: Point;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorFile, setEditorFile] = useState<File | null>(null);
  const [editorFileUrl, setEditorFileUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<Size | null>(null);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [processingEdit, setProcessingEdit] = useState(false);

  const previewSize = useMemo(() => getPreviewSize(aspectRatio), [aspectRatio]);
  const editorFrameSize = useMemo(
    () => getEditorFrameSize(aspectRatio),
    [aspectRatio],
  );
  const outputSize = useMemo(
    () => getOutputSize(aspectRatio, outputWidth, outputHeight),
    [aspectRatio, outputHeight, outputWidth],
  );
  const maxZoom = Math.max(minZoom * MAX_ZOOM_MULTIPLIER, minZoom + 0.5);

  const clearEditorState = useCallback(() => {
    dragStateRef.current = null;
    setEditorOpen(false);
    setEditorFile(null);
    setEditorFileUrl(null);
    setNaturalSize(null);
    setPosition({ x: 0, y: 0 });
    setZoom(1);
    setMinZoom(1);
    setProcessingEdit(false);
  }, []);

  useEffect(() => {
    if (!editorFileUrl) return undefined;

    return () => {
      URL.revokeObjectURL(editorFileUrl);
    };
  }, [editorFileUrl]);

  useEffect(() => {
    if (!editorFileUrl) return undefined;

    let cancelled = false;

    void loadImage(editorFileUrl)
      .then((image) => {
        if (cancelled) return;

        const nextNaturalSize = {
          width: image.naturalWidth,
          height: image.naturalHeight,
        };
        const nextMinZoom = Math.max(
          editorFrameSize.width / nextNaturalSize.width,
          editorFrameSize.height / nextNaturalSize.height,
        );
        const imageSize = {
          width: nextNaturalSize.width * nextMinZoom,
          height: nextNaturalSize.height * nextMinZoom,
        };

        setNaturalSize(nextNaturalSize);
        setMinZoom(nextMinZoom);
        setZoom(nextMinZoom);
        setPosition(getCenteredPosition(imageSize, editorFrameSize));
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(
          loadError instanceof Error ? loadError.message : COPY.loadEditorFailed,
        );
        clearEditorState();
      });

    return () => {
      cancelled = true;
    };
  }, [clearEditorState, editorFileUrl, editorFrameSize]);

  const uploadSingleFile = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const data = await apiClient.post<{ url: string }>(
        "/upload/image",
        formData,
      );
      onChange(data.url);
    },
    [folder, onChange],
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      setUploading(true);
      setError(null);

      try {
        for (const file of files) {
          await uploadSingleFile(file);
        }
      } catch (uploadError) {
        const message =
          uploadError instanceof Error ? uploadError.message : COPY.uploadFailed;
        setError(message);
        throw uploadError instanceof Error ? uploadError : new Error(message);
      } finally {
        setUploading(false);
      }
    },
    [uploadSingleFile],
  );

  const startEditor = useCallback(
    (file: File) => {
      setError(null);
      setEditorFile(file);
      setEditorFileUrl(URL.createObjectURL(file));
      setEditorOpen(true);
    },
    [],
  );

  const handleSelectedFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      const limitedFiles =
        typeof maxFiles === "number" && maxFiles >= 0
          ? files.slice(0, maxFiles)
          : files;

      if (
        typeof maxFiles === "number" &&
        maxFiles >= 0 &&
        files.length > maxFiles
      ) {
        setError(
          `${COPY.maxFilesExceeded} ${maxFiles}${COPY.maxFilesExceededSuffix}`,
        );
      }

      const validationError = limitedFiles
        .map((file) => validateFile(file))
        .find((message) => message !== null);
      if (validationError) {
        setError(validationError);
        return;
      }

      if (enableEditor && limitedFiles.length === 1) {
        startEditor(limitedFiles[0]);
        return;
      }

      void uploadFiles(limitedFiles).catch(() => undefined);
    },
    [enableEditor, maxFiles, startEditor, uploadFiles],
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      handleSelectedFiles(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragOver(false);

      const droppedFiles = Array.from(event.dataTransfer.files ?? []);
      const files = multiple ? droppedFiles : droppedFiles.slice(0, 1);
      if (files.length > 0) {
        handleSelectedFiles(files);
      }
    },
    [handleSelectedFiles, multiple],
  );

  const handleRemove = () => {
    onChange(null);
    setError(null);
  };

  const handleZoomChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!naturalSize) return;

      const nextZoom = clamp(Number(event.target.value), minZoom, maxZoom);
      const centerX = (editorFrameSize.width / 2 - position.x) / zoom;
      const centerY = (editorFrameSize.height / 2 - position.y) / zoom;
      const nextImageSize = {
        width: naturalSize.width * nextZoom,
        height: naturalSize.height * nextZoom,
      };

      setZoom(nextZoom);
      setPosition(
        clampPosition(
          {
            x: editorFrameSize.width / 2 - centerX * nextZoom,
            y: editorFrameSize.height / 2 - centerY * nextZoom,
          },
          nextImageSize,
          editorFrameSize,
        ),
      );
    },
    [editorFrameSize, maxZoom, minZoom, naturalSize, position, zoom],
  );

  const handleEditorPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!naturalSize) return;

      dragStateRef.current = {
        pointerId: event.pointerId,
        startPointer: { x: event.clientX, y: event.clientY },
        startPosition: position,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [naturalSize, position],
  );

  const handleEditorPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId || !naturalSize) {
        return;
      }

      const nextImageSize = {
        width: naturalSize.width * zoom,
        height: naturalSize.height * zoom,
      };

      setPosition(
        clampPosition(
          {
            x: dragState.startPosition.x + (event.clientX - dragState.startPointer.x),
            y: dragState.startPosition.y + (event.clientY - dragState.startPointer.y),
          },
          nextImageSize,
          editorFrameSize,
        ),
      );
    },
    [editorFrameSize, naturalSize, zoom],
  );

  const handleEditorPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (
        dragStateRef.current?.pointerId === event.pointerId &&
        event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragStateRef.current = null;
    },
    [],
  );

  const handleApplyEditor = useCallback(async () => {
    if (!editorFile || !editorFileUrl || !naturalSize) return;

    setProcessingEdit(true);
    setError(null);

    try {
      const image = await loadImage(editorFileUrl);
      const canvas = document.createElement("canvas");
      canvas.width = outputSize.width;
      canvas.height = outputSize.height;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error(COPY.editStartFailed);
      }

      const sourceWidth = editorFrameSize.width / zoom;
      const sourceHeight = editorFrameSize.height / zoom;
      const sourceX = clamp(
        -position.x / zoom,
        0,
        Math.max(0, naturalSize.width - sourceWidth),
      );
      const sourceY = clamp(
        -position.y / zoom,
        0,
        Math.max(0, naturalSize.height - sourceHeight),
      );

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        outputSize.width,
        outputSize.height,
      );

      const mimeType = editorFile.type === "image/png" ? "image/png" : "image/jpeg";
      const extension = mimeType === "image/png" ? "png" : "jpg";
      const blob = await canvasToBlob(
        canvas,
        mimeType,
        mimeType === "image/png" ? undefined : 0.92,
      );
      const croppedFile = new File(
        [blob],
        replaceFileExtension(editorFile.name, extension),
        { type: mimeType },
      );

      await uploadFiles([croppedFile]);
      clearEditorState();
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : COPY.editFailed);
    } finally {
      setProcessingEdit(false);
    }
  }, [
    clearEditorState,
    editorFile,
    editorFileUrl,
    editorFrameSize,
    naturalSize,
    outputSize,
    position,
    uploadFiles,
    zoom,
  ]);

  return (
    <div className="mb-5">
      <label className="block text-sm text-text-secondary mb-2 font-semibold">
        {label}
      </label>

      {value ? (
        <div className="relative inline-block">
          <Image
            src={value}
            alt={label}
            width={previewSize.width}
            height={previewSize.height}
            className="w-full max-w-[240px] object-cover rounded border border-border"
            style={{ aspectRatio }}
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 text-white text-xs font-bold flex items-center justify-center cursor-pointer border-none hover:bg-black/90 transition-colors"
            title={COPY.removeImage}
          >
            X
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`
            w-full max-w-[240px] border-2 border-dashed rounded
            flex flex-col items-center justify-center cursor-pointer
            text-text-tertiary transition-colors duration-200
            ${dragOver
              ? "border-primary-500 bg-primary-500/10"
              : "border-border bg-bg-tertiary hover:border-text-tertiary"
            }
          `}
          style={{ aspectRatio }}
        >
          {uploading ? (
            <span className="text-sm text-text-secondary">{COPY.uploading}</span>
          ) : (
            <>
              <span className="text-[28px] mb-2">+</span>
              <span className="text-sm text-text-secondary text-center px-4">
                {multiple ? COPY.uploadPromptMultiple : COPY.uploadPrompt}
              </span>
              <span className="text-2xs text-text-tertiary mt-1">
                {COPY.uploadHint}
              </span>
              {enableEditor && (
                <span className="text-2xs text-text-tertiary mt-1">
                  {multiple ? COPY.editHintMultiple : COPY.editHint}
                </span>
              )}
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        multiple={multiple}
        onChange={handleFileChange}
        className="hidden"
      />

      {error && <div className="text-danger-500 text-xs mt-1.5">{error}</div>}

      <Modal
        open={editorOpen}
        title={editorTitle}
        onClose={() => {
          if (processingEdit || uploading) return;
          clearEditorState();
        }}
        width={520}
        footer={
          <>
            <button
              type="button"
              onClick={() => clearEditorState()}
              disabled={processingEdit || uploading}
              className="px-4 py-2 rounded-md border border-border bg-bg-secondary text-foreground text-sm hover:bg-bg-tertiary transition-colors disabled:opacity-50"
            >
              {COPY.cancel}
            </button>
            <button
              type="button"
              onClick={() => void handleApplyEditor()}
              disabled={!naturalSize || processingEdit || uploading}
              className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50"
            >
              {processingEdit || uploading ? COPY.saving : COPY.saveEdited}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-bg-tertiary px-3 py-2 text-xs text-text-secondary">
            {COPY.editorHelpPrefix} {outputSize.width} x {outputSize.height}
            {COPY.editorHelpSuffix}
          </div>

          <div
            className="relative mx-auto overflow-hidden rounded-lg border border-border bg-black/5 touch-none select-none"
            style={{
              width: editorFrameSize.width,
              height: editorFrameSize.height,
            }}
            onPointerDown={handleEditorPointerDown}
            onPointerMove={handleEditorPointerMove}
            onPointerUp={handleEditorPointerEnd}
            onPointerCancel={handleEditorPointerEnd}
          >
            {editorFileUrl && naturalSize ? (
              <Image
                src={editorFileUrl}
                alt={COPY.defaultEditorTitle}
                width={naturalSize.width}
                height={naturalSize.height}
                unoptimized
                className="absolute max-w-none pointer-events-none"
                style={{
                  left: position.x,
                  top: position.y,
                  width: naturalSize.width * zoom,
                  height: naturalSize.height * zoom,
                }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-text-secondary">
                {COPY.loadingImage}
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 border-[3px] border-white/85 shadow-[0_0_0_9999px_rgba(15,23,42,0.32)]" />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-text-secondary">
              <span>{COPY.zoom}</span>
              <span>{Math.round((zoom / minZoom) * 100)}%</span>
            </div>
            <input
              type="range"
              min={minZoom}
              max={maxZoom}
              step={0.01}
              value={zoom}
              onChange={handleZoomChange}
              disabled={!naturalSize || processingEdit || uploading}
              className="w-full accent-primary-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
