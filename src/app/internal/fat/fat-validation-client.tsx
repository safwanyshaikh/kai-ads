"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FatSample } from "@/server/fat-samples";
import type { FatSnapshot } from "@/server/services/fat-validation.service";

/**
 * Task 006.5 — the Founder validation page's interactivity. This is the
 * ONLY client component in the whole FAT bridge; everything else is a
 * server component or a route handler. No styling investment beyond the
 * app's existing UI primitives — this is a validation tool, not a
 * product screen.
 */

type Mode = "text" | "file" | "url";

const KIND_MODE: Record<string, Mode> = {
  WHATSAPP_TEXT: "text",
  PLAIN_TEXT: "text",
  PDF: "file",
  WORD: "file",
  IMAGE: "file",
  EXCEL: "file",
  GOOGLE_SHEET: "url",
  WEBSITE: "url",
};

const KIND_LABELS: Record<string, string> = {
  WHATSAPP_TEXT: "WhatsApp text",
  PDF: "PDF",
  IMAGE: "Image / Screenshot",
  EXCEL: "Excel",
  WORD: "Word",
  GOOGLE_SHEET: "Public Google Sheet",
  WEBSITE: "Public URL",
};

interface RunSummary {
  id: string;
  inputType: string;
  status: string;
  createdAt: Date;
  jobOrderId: string | null;
}

interface Determination {
  attribute?: string;
  field?: string;
  code?: string;
  value: string;
  confidencePct?: number;
  confidence?: number;
  source: string;
  reason: string;
}

/** One row: Decision / Confidence / Reason / Source — the one shape every engine's output shares. */
function DeterminationRow({ item }: { item: Determination }) {
  const label = item.attribute ?? item.field ?? item.code ?? "—";
  const confidence = item.confidencePct ?? item.confidence ?? 0;
  return (
    <div className="border-b py-2 text-sm last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {item.value} · {confidence}% confidence
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="font-medium">Source:</span> {item.source} — <span className="font-medium">Reason:</span> {item.reason}
      </p>
    </div>
  );
}

function EngineSection({
  title,
  items,
}: {
  title: string;
  items: Determination[] | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button variant="outline" type="button" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide JSON" : "Expand JSON"}
        </Button>
      </CardHeader>
      <CardContent>
        {!items || items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No determinations.</p>
        ) : (
          items.map((item, index) => <DeterminationRow key={`${item.attribute ?? item.field ?? item.code}-${index}`} item={item} />)
        )}
        {expanded && (
          <pre className="mt-3 max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
            {JSON.stringify(items, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

export function FatValidationClient({
  samples,
  initialRuns,
}: {
  samples: FatSample[];
  initialRuns: RunSummary[];
}) {
  const [kind, setKind] = useState("WHATSAPP_TEXT");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FatSnapshot | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>(initialRuns);
  const [health, setHealth] = useState<Record<string, boolean> | null>(null);

  const mode = KIND_MODE[kind];

  async function refreshRuns() {
    const response = await fetch("/api/internal/fat/runs");
    const body = await response.json();
    if (response.ok) setRuns(body.data);
  }

  async function checkHealth() {
    const response = await fetch("/api/internal/fat/health");
    const body = await response.json();
    if (response.ok) setHealth(body.data);
  }

  function loadSample(sample: FatSample) {
    setKind(sample.kind);
    setError(null);
    setNote(sample.note ?? null);
    if (sample.text) {
      setText(sample.text);
      setUrl("");
    }
  }

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.set("kind", kind);
      if (mode === "text") formData.set("text", text);
      if (mode === "url") formData.set("url", url);
      if (mode === "file" && file) formData.set("file", file);

      const response = await fetch("/api/internal/fat/intake", { method: "POST", body: formData });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? "The run failed.");
        return;
      }
      setResult(body.data);
      await refreshRuns();
    } catch {
      setError("Network error — the request never reached the server.");
    } finally {
      setRunning(false);
    }
  }

  async function viewResult(runId: string) {
    setError(null);
    const response = await fetch(`/api/internal/fat/runs/${runId}`);
    const body = await response.json();
    if (!response.ok) {
      setError(body.error?.message ?? "Could not load that run.");
      return;
    }
    setResult(body.data);
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Health */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Health</CardTitle>
          <Button type="button" variant="outline" onClick={checkHealth}>
            Check
          </Button>
        </CardHeader>
        {health && (
          <CardContent className="flex flex-wrap gap-3 text-sm">
            {Object.entries(health).map(([key, ok]) => (
              <span key={key} className={ok ? "text-green-600" : "text-red-600"}>
                {ok ? "●" : "●"} {key}
              </span>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Sample pack */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Founder Sample Pack</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {samples.map((sample) => (
            <Button key={sample.kind} type="button" variant="outline" onClick={() => loadSample(sample)}>
              {sample.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Intake form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Input type</Label>
            <select
              className="mt-1 block w-full rounded border px-3 py-2 text-sm"
              value={kind}
              onChange={(event) => {
                setKind(event.target.value);
                setNote(null);
              }}
            >
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {note && (
            <Alert>
              <AlertDescription>{note}</AlertDescription>
            </Alert>
          )}

          {mode === "text" && (
            <div>
              <Label>Paste text</Label>
              <Textarea rows={8} value={text} onChange={(event) => setText(event.target.value)} />
            </div>
          )}

          {mode === "url" && (
            <div>
              <Label>Public URL</Label>
              <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" />
            </div>
          )}

          {mode === "file" && (
            <div>
              <Label>Upload file</Label>
              <input
                type="file"
                className="mt-1 block text-sm"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
          )}

          <Button type="button" onClick={run} disabled={running}>
            {running ? "Running…" : "Run"}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Run {result.run.id}</CardTitle>
              <div className="flex gap-2">
                <a
                  className="text-sm underline"
                  href={`/api/internal/fat/runs/${result.run.id}/export?scope=jobOrder`}
                >
                  Export JobOrder JSON
                </a>
                <a
                  className="text-sm underline"
                  href={`/api/internal/fat/runs/${result.run.id}/export?scope=intelligence`}
                >
                  Export Intelligence JSON
                </a>
                <a
                  className="text-sm underline"
                  href={`/api/internal/fat/runs/${result.run.id}/export?scope=complete`}
                >
                  Download Complete Result
                </a>
              </div>
            </CardHeader>
            <CardContent className="text-sm">
              Status: <span className="font-medium">{result.run.status}</span>
              {result.warnings.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                  {result.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              )}
              {result.unreadable.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs text-red-600">
                  {result.unreadable.map((item, index) => (
                    <li key={index}>{JSON.stringify(item)}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Requirement Intelligence -> JobOrder -> JobOrder Intelligence -> Compliance -> Campaign -> Layout */}
          <EngineSection
            title="Requirement Intelligence — facts"
            items={result.requirementIntelligence.facts as Determination[]}
          />

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">JobOrder — canonical</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
                {JSON.stringify(result.jobOrder, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <EngineSection
            title="JobOrder Intelligence"
            items={result.jobOrderIntelligence.determinations as Determination[]}
          />
          <EngineSection
            title="Compliance Intelligence"
            items={result.complianceIntelligence.determinations as Determination[]}
          />
          <EngineSection
            title="Campaign Intelligence"
            items={result.campaignIntelligence.determinations as Determination[]}
          />
          <EngineSection
            title="Layout Intelligence"
            items={result.layoutIntelligence.determinations as Determination[]}
          />
        </div>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-1">Timestamp</th>
                  <th>Input type</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b last:border-b-0">
                    <td className="py-1">{new Date(run.createdAt).toLocaleString()}</td>
                    <td>{run.inputType}</td>
                    <td>{run.status}</td>
                    <td>
                      <Button type="button" variant="outline" onClick={() => viewResult(run.id)}>
                        View Result
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
