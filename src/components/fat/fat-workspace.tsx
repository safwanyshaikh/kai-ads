"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StageCard } from "./stage-card";
import type { FatRunResult } from "@/server/fat/pipeline";

type RealSourceType = "PASTE_TEXT" | "PDF" | "DOCX" | "IMAGE";
type DisabledSourceType = "EXCEL" | "VOICE_NOTE" | "GOOGLE_SHEET_URL" | "WEBSITE_URL";

const REAL_SOURCES: { key: RealSourceType; label: string }[] = [
  { key: "PASTE_TEXT", label: "Paste requirement text" },
  { key: "PDF", label: "Upload PDF" },
  { key: "IMAGE", label: "Upload Image" },
  { key: "DOCX", label: "Upload Word" },
];

const DISABLED_SOURCES: { key: DisabledSourceType; label: string }[] = [
  { key: "EXCEL", label: "Upload Excel" },
  { key: "VOICE_NOTE", label: "Upload Voice Note" },
  { key: "GOOGLE_SHEET_URL", label: "Google Sheet URL" },
  { key: "WEBSITE_URL", label: "Website URL" },
];

const STAGE_ORDER = [
  "requirementIntelligence",
  "jobOrder",
  "complianceIntelligence",
  "campaignIntelligence",
  "layoutIntelligence",
] as const;

interface HistoryRow {
  id: string;
  actorEmail: string;
  sourceType: string;
  sourceLabel: string | null;
  draftId: string | null;
  advertisementId: string | null;
  succeeded: boolean;
  errorMessage: string | null;
  createdAt: string;
}

async function readJson(res: Response) {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error?.message ?? body?.message ?? `Request failed (${res.status})`);
  }
  return body;
}

export function FatWorkspace({ founderEmail }: { founderEmail: string }) {
  const [sourceType, setSourceType] = useState<RealSourceType>("PASTE_TEXT");
  const [rawText, setRawText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FatRunResult | null>(null);
  const [showFullJson, setShowFullJson] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/internal/fat/history?limit=25");
      const body = await readJson(res);
      setHistory(body.data);
    } catch {
      // Run History is a convenience view; a failed refresh should not block the console.
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleRun() {
    setError(null);
    setResult(null);
    setGenerateResult(null);
    setRunning(true);
    try {
      let sourceFileUrl: string | undefined;
      let sourceLabel: string | undefined;

      if (sourceType !== "PASTE_TEXT") {
        if (!file) throw new Error(`Choose a file to upload for ${sourceType}.`);
        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/internal/fat/upload", { method: "POST", body: formData });
        const uploadBody = await readJson(uploadRes);
        sourceFileUrl = uploadBody.data.url;
        sourceLabel = file.name;
        setUploading(false);
      } else {
        if (rawText.trim().length < 10) throw new Error("Paste at least 10 characters of requirement text.");
        sourceLabel = "Pasted text";
      }

      const runRes = await fetch("/api/internal/fat/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          rawText: sourceType === "PASTE_TEXT" ? rawText : undefined,
          sourceFileUrl,
          instructions: instructions.trim() || undefined,
          sourceLabel,
        }),
      });
      const runBody = await readJson(runRes);
      setResult(runBody.data);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The pipeline run failed.");
    } finally {
      setUploading(false);
      setRunning(false);
    }
  }

  async function handleGenerateFull() {
    if (!result?.advertisementId) return;
    setGenerating(true);
    setGenerateResult(null);
    try {
      const res = await fetch("/api/internal/fat/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advertisementId: result.advertisementId, platformFormat: "generic_square" }),
      });
      const body = await readJson(res);
      setGenerateResult({ ok: true, message: `Generated. trustStatus=${body.data.trustStatus}` });
    } catch (err) {
      setGenerateResult({ ok: false, message: err instanceof Error ? err.message : "Full generation failed." });
    } finally {
      setGenerating(false);
    }
  }

  function exportUrl(scope: "jobOrder" | "intelligence" | "complete") {
    return result ? `/api/internal/fat/export/${result.runId}?scope=${scope}` : "#";
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 pb-16">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Founder Validation — /internal/fat</h1>
          <Badge variant="outline">KAI_SUPER_ADMIN</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Signed in as {founderEmail}. Task 006.5 — the permanent validation console for every
          intelligence engine. Runs against a reserved sandbox agency; never a real tenant&apos;s data.
        </p>
      </header>

      <Card>
        <CardHeader>
          <p className="font-semibold">1 · Choose input</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {REAL_SOURCES.map((s) => (
              <Button
                key={s.key}
                type="button"
                variant={sourceType === s.key ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSourceType(s.key);
                  setFile(null);
                }}
              >
                {s.label}
              </Button>
            ))}
            {DISABLED_SOURCES.map((s) => (
              <Button key={s.key} type="button" variant="outline" size="sm" disabled title="Not yet supported by the extraction engine">
                {s.label}
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            Excel, Voice Note, Google Sheet URL and Website URL are shown per spec but disabled — the
            KAI Intelligence Engine (Tasks 001–006) only accepts PASTE_TEXT, PDF, DOCX, and IMAGE
            today. Enabling the other four would be new ingestion logic, which Task 006.5 is
            explicitly scoped not to add.
          </p>

          {sourceType === "PASTE_TEXT" ? (
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste a real recruitment requirement here (min. 10 characters)…"
              rows={8}
            />
          ) : (
            <input
              type="file"
              accept={sourceType === "PDF" ? "application/pdf" : sourceType === "DOCX" ? ".docx" : "image/*"}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Instructions (optional)
            </label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Any extra guidance for extraction…"
              rows={2}
            />
          </div>

          <Button onClick={handleRun} disabled={running} size="lg">
            {uploading ? "Uploading…" : running ? "Running pipeline…" : "RUN PIPELINE"}
          </Button>

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">2 · Pipeline result</h2>
            <div className="flex flex-wrap gap-2">
              <a href={exportUrl("jobOrder")} className="text-sm underline underline-offset-2">
                Export JobOrder JSON
              </a>
              <a href={exportUrl("intelligence")} className="text-sm underline underline-offset-2">
                Export Intelligence JSON
              </a>
              <a href={exportUrl("complete")} className="text-sm underline underline-offset-2">
                Export Complete Result
              </a>
            </div>
          </div>

          <div className="space-y-3">
            {STAGE_ORDER.map((key, i) => (
              <StageCard key={key} index={i + 1} result={result.stages[key]} />
            ))}
          </div>

          {result.advertisementId && (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                <div>
                  <p className="text-sm font-medium">Optional: full generation</p>
                  <p className="text-muted-foreground text-xs">
                    Calls the real image-generation pipeline (Task 004) to see the actual footer/branding
                    Layout Intelligence decision and rendered artwork. Costs one sandbox-agency
                    generation credit and a real AI call.
                  </p>
                </div>
                <Button variant="outline" onClick={handleGenerateFull} disabled={generating}>
                  {generating ? "Generating…" : "Generate Full Advertisement"}
                </Button>
              </CardContent>
              {generateResult && (
                <CardContent className="pt-0">
                  <p className={generateResult.ok ? "text-sm text-green-700" : "text-sm text-destructive"}>
                    {generateResult.message}
                  </p>
                </CardContent>
              )}
            </Card>
          )}

          <div>
            <button
              type="button"
              className="text-sm font-medium text-primary underline underline-offset-2"
              onClick={() => setShowFullJson((v) => !v)}
            >
              {showFullJson ? "Hide raw JSON viewer" : "Show raw JSON viewer (complete result)"}
            </button>
            {showFullJson && (
              <pre className="mt-2 max-h-[32rem] overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Run History</h2>
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            {history.length === 0 ? (
              <p className="text-muted-foreground text-sm">No runs yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-xs uppercase">
                    <th className="pb-2 pr-4">When</th>
                    <th className="pb-2 pr-4">Source</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Job Order</th>
                    <th className="pb-2">Export</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">{row.sourceLabel ?? row.sourceType}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={row.succeeded ? "outline" : "outline"} className={row.succeeded ? "bg-green-100 text-green-800 border-green-300" : "bg-red-100 text-red-800 border-red-300"}>
                          {row.succeeded ? "OK" : "FAILED"}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{row.advertisementId ?? "—"}</td>
                      <td className="py-2">
                        <a
                          href={`/api/internal/fat/export/${row.id}?scope=complete`}
                          className="underline underline-offset-2"
                        >
                          JSON
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
