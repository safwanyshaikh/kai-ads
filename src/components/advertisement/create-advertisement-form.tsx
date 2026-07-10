"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { API_ROUTES, APP_ROUTES } from "@/lib/constants";
import { postJson } from "@/lib/api-client";
import type { CreateDraftInput } from "@/lib/validations/advertisement-draft";

const UPLOAD_METHODS = [
  { type: "PDF" as const, label: "Upload PDF", accept: "application/pdf" },
  {
    type: "DOCX" as const,
    label: "Upload DOCX",
    accept: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  { type: "IMAGE" as const, label: "Upload Image", accept: "image/png,image/jpeg,image/webp" },
  {
    type: "WHATSAPP_SCREENSHOT" as const,
    label: "Upload WhatsApp Screenshot",
    accept: "image/png,image/jpeg,image/webp",
  },
];

export function CreateAdvertisementForm() {
  const router = useRouter();
  const [method, setMethod] = useState<CreateDraftInput["sourceType"]>("PASTE_TEXT");
  const [pastedText, setPastedText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(API_ROUTES.uploadAdvertisementSource, {
        method: "POST",
        body: formData,
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Upload failed");
      }
      await createDraft({ sourceType: method, sourceFileUrl: body.data.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function createDraft(input: CreateDraftInput) {
    setCreating(true);
    setError(null);
    const result = await postJson<{ id: string }>(API_ROUTES.advertisementDrafts, input);
    setCreating(false);

    if (!result.ok) {
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

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={method === "PASTE_TEXT" ? "default" : "outline"}
          size="sm"
          onClick={() => setMethod("PASTE_TEXT")}
        >
          Paste Requirement
        </Button>
        {UPLOAD_METHODS.map((m) => (
          <Button
            key={m.type}
            type="button"
            variant={method === m.type ? "default" : "outline"}
            size="sm"
            onClick={() => setMethod(m.type)}
          >
            {m.label}
          </Button>
        ))}
      </div>

      {method === "PASTE_TEXT" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paste Requirement</CardTitle>
            <CardDescription>
              Paste the raw requirement text — an email, a message, or notes from a client call.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              rows={10}
              placeholder="Need 10 welders for a 2-year contract in the UAE..."
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
            />
            <Button
              disabled={creating || pastedText.trim().length < 10}
              onClick={() => createDraft({ sourceType: "PASTE_TEXT", rawText: pastedText })}
            >
              {creating ? "Starting…" : "Continue"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {UPLOAD_METHODS.find((m) => m.type === method)?.label}
            </CardTitle>
            <CardDescription>Files are stored as-is in this sprint — text extraction is a future-sprint AI feature.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="file"
              accept={UPLOAD_METHODS.find((m) => m.type === method)?.accept}
              disabled={uploading || creating}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
            {(uploading || creating) && (
              <p className="mt-2 text-sm text-muted-foreground">Uploading…</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
