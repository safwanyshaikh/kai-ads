"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { API_ROUTES, APP_ROUTES } from "@/lib/constants";
import { postJson } from "@/lib/api-client";
import type { CreateDraftInput, DraftAttachmentInput } from "@/lib/validations/advertisement-draft";

/**
 * Everything the composer accepts, and what each MIME becomes. WhatsApp
 * screenshots arrive as ordinary PNG/JPEG files with no distinguishing
 * MIME, so they are staged as IMAGE — the extraction engine treats both
 * identically (same vision path), so nothing is lost by not asking.
 */
const ACCEPTED_TYPES: Record<string, DraftAttachmentInput["sourceType"]> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "image/png": "IMAGE",
  "image/jpeg": "IMAGE",
  "image/webp": "IMAGE",
};

const ACCEPT_ATTRIBUTE = Object.keys(ACCEPTED_TYPES).join(",");
const MAX_ATTACHMENTS = 10; // mirrors createDraftSchema's attachments cap

const TYPE_LABELS: Record<DraftAttachmentInput["sourceType"], string> = {
  PDF: "PDF",
  DOCX: "Word",
  IMAGE: "Image",
  WHATSAPP_SCREENSHOT: "WhatsApp",
};

interface StagedFile {
  /** Local-only key for React lists and removal — never sent to the server. */
  id: string;
  file: File;
  sourceType: DraftAttachmentInput["sourceType"];
  /** Object URL for image thumbnails; undefined for documents. Revoked on removal/unmount. */
  previewUrl?: string;
}

/**
 * The single ChatGPT-style composer (Supreme Constitution Principles 12
 * and 13). One surface, no mode picker, no modal steps: type or paste a
 * requirement, drop/attach/paste any mix of PDFs, DOCX files, and
 * images, remove any of them, keep typing — then one submit produces
 * exactly ONE draft (and downstream, one advertisement) from everything
 * together. Files upload on submit, not on staging, so removal before
 * submit is free and nothing orphaned lands in storage for abandoned
 * compositions.
 */
export function CreateAdvertisementForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Revoke every remaining thumbnail object URL when the composer
  // unmounts (successful submit navigates away; abandoned staging would
  // otherwise leak blob URLs for the lifetime of the tab).
  const stagedRef = useRef(staged);
  stagedRef.current = staged;
  useEffect(() => {
    return () => stagedRef.current.forEach((s) => s.previewUrl && URL.revokeObjectURL(s.previewUrl));
  }, []);

  const addFiles = useCallback((files: Iterable<File>) => {
    setError(null);
    setStaged((current) => {
      const next = [...current];
      for (const file of files) {
        const sourceType = ACCEPTED_TYPES[file.type];
        if (!sourceType) {
          setError(`"${file.name}" is not a supported file. Attach a PDF, DOCX, PNG, JPEG, or WEBP.`);
          continue;
        }
        if (next.length >= MAX_ATTACHMENTS) {
          setError(`A maximum of ${MAX_ATTACHMENTS} attachments is supported per advertisement.`);
          break;
        }
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          sourceType,
          previewUrl: sourceType === "IMAGE" ? URL.createObjectURL(file) : undefined,
        });
      }
      return next;
    });
  }, []);

  function removeFile(id: string) {
    setStaged((current) => {
      const target = current.find((s) => s.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((s) => s.id !== id);
    });
  }

  /** Pasted screenshots (e.g. a WhatsApp conversation) arrive as clipboard files — stage them like any other attachment. Text pastes fall through to the textarea untouched. */
  function handlePaste(event: React.ClipboardEvent) {
    const files = Array.from(event.clipboardData.files);
    if (files.length > 0) {
      event.preventDefault();
      addFiles(files);
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragActive(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  const busy = progress !== null;
  const canSubmit = !busy && (staged.length > 0 || text.trim().length >= 10);

  async function handleSubmit() {
    setError(null);

    // Files upload sequentially so each gets the full request budget and
    // the recruiter sees honest per-file progress.
    const attachments: DraftAttachmentInput[] = [];
    try {
      for (const [index, item] of staged.entries()) {
        setProgress(`Uploading ${index + 1} of ${staged.length} — ${item.file.name}…`);
        const formData = new FormData();
        formData.append("file", item.file);
        const response = await fetch(API_ROUTES.uploadAdvertisementSource, {
          method: "POST",
          body: formData,
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.error?.message ?? `"${item.file.name}" could not be uploaded`);
        }
        attachments.push({
          url: body.data.url,
          sourceType: item.sourceType,
          fileName: item.file.name,
          mimeType: item.file.type,
        });
      }
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : "Upload failed");
      return;
    }

    // One draft from everything together. With attachments, the draft's
    // sourceType mirrors the FIRST attachment (there is deliberately no
    // "MIXED" value — see createDraftSchema) and the typed text travels
    // as instructions; text-only submits are a classic Paste Requirement.
    const trimmed = text.trim();
    const input: CreateDraftInput =
      attachments.length > 0
        ? {
            sourceType: attachments[0].sourceType,
            instructions: trimmed || undefined,
            attachments,
          }
        : { sourceType: "PASTE_TEXT", rawText: trimmed };

    setProgress("Starting your advertisement…");
    const result = await postJson<{ id: string }>(API_ROUTES.advertisementDrafts, input);
    if (!result.ok) {
      setProgress(null);
      setError(result.message ?? "Could not start this advertisement");
      return;
    }
    router.push(APP_ROUTES.advertisementDraft(result.data!.id));
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not start this advertisement</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card
        className={dragActive ? "border-primary ring-2 ring-primary/30" : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <CardContent className="space-y-4 pt-6">
          {staged.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {staged.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-md border bg-muted/50 py-1 pl-1 pr-2 text-sm"
                >
                  {item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local blob preview, never a remote asset
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-semibold">
                      {TYPE_LABELS[item.sourceType]}
                    </span>
                  )}
                  <span className="max-w-[180px] truncate" title={item.file.name}>
                    {item.file.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{TYPE_LABELS[item.sourceType]}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${item.file.name}`}
                    className="text-muted-foreground hover:text-foreground"
                    disabled={busy}
                    onClick={() => removeFile(item.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <Textarea
            rows={8}
            placeholder="Paste the requirement, drop files, or type instructions — e.g. “Need 10 welders for a 2-year UAE contract, details in the attached PDF.”"
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            onPaste={handlePaste}
          />

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              accept={ACCEPT_ATTRIBUTE}
              onChange={(e) => {
                if (e.target.files) addFiles(Array.from(e.target.files));
                e.target.value = ""; // allow re-attaching the same file after removal
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              Attach files
            </Button>
            <p className="text-xs text-muted-foreground">
              PDF, DOCX, or images — drag & drop and paste work too.
            </p>
            <Button className="ml-auto" disabled={!canSubmit} onClick={handleSubmit}>
              {busy ? "Working…" : "Create Advertisement"}
            </Button>
          </div>

          {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
