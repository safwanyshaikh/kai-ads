"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { API_ROUTES } from "@/lib/constants";
import { postJson } from "@/lib/api-client";

type SectionKey = "HEADER" | "AGENCY_FOOTER";

const SECTIONS: { key: SectionKey; label: string; field: string; multiline?: boolean }[] = [
  { key: "HEADER", label: "Header", field: "header" },
  { key: "AGENCY_FOOTER", label: "Footer", field: "footer", multiline: true },
];

/**
 * Section Editor (Sprint 005). Covers the free-text sections directly —
 * Positions/Benefits/Interview/Contact are structured objects already
 * editable through the full advertisement edit form; this focuses on
 * the two single-value text sections a recruiter most often tweaks after
 * seeing the generated result (e.g. sharpening the header). Every save
 * goes through the same section API used by every editing path in this
 * app, so it's a real MANUAL_EDIT version, not a local-only change.
 */
export function SectionEditor({
  advertisementId,
  header,
  footer,
}: {
  advertisementId: string;
  header: string;
  footer: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<SectionKey | null>(null);
  const [values, setValues] = useState<Record<string, string>>({ header, footer: footer ?? "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(section: (typeof SECTIONS)[number]) {
    setSaving(true);
    setError(null);
    const result = await postJson(API_ROUTES.advertisementSection(advertisementId), {
      section: section.key,
      data: { [section.field]: values[section.field] },
      method: "MANUAL_EDIT",
      reason: `Edited ${section.label.toLowerCase()}`,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.message ?? "Could not save this section");
      return;
    }
    setOpen(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Edit a Section</CardTitle>
        <CardDescription>
          Editing one section preserves everything else and creates a new version. Regenerate afterward to see it
          in the rendered advertisement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {SECTIONS.map((section) => (
          <div key={section.key} className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{section.label}</span>
              <Button size="sm" variant="ghost" onClick={() => setOpen(open === section.key ? null : section.key)}>
                {open === section.key ? "Cancel" : "Edit"}
              </Button>
            </div>
            {open === section.key ? (
              <div className="mt-2 space-y-2">
                {section.multiline ? (
                  <Textarea
                    rows={2}
                    value={values[section.field]}
                    onChange={(e) => setValues((prev) => ({ ...prev, [section.field]: e.target.value }))}
                  />
                ) : (
                  <Input
                    value={values[section.field]}
                    onChange={(e) => setValues((prev) => ({ ...prev, [section.field]: e.target.value }))}
                  />
                )}
                <Button size="sm" disabled={saving} onClick={() => handleSave(section)}>
                  {saving ? "Saving…" : "Save Section"}
                </Button>
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">{values[section.field] || "(empty)"}</p>
            )}
          </div>
        ))}

        <p className="text-xs text-muted-foreground">
          Positions, benefits, interview, and contact are edited through the full advertisement edit form.
        </p>
      </CardContent>
    </Card>
  );
}
