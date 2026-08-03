"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StageResult } from "@/server/fat/pipeline";

const CONFIDENCE_STYLE: Record<string, string> = {
  HIGH: "bg-green-100 text-green-800 border-green-300",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-300",
  LOW: "bg-red-100 text-red-800 border-red-300",
  "N/A": "bg-muted text-muted-foreground border-border",
};

/**
 * Task 006.5 — one expandable card per pipeline stage, showing exactly
 * Decision / Confidence / Reason / Source as specified, with the raw
 * stage payload available behind "Raw JSON" rather than always rendered.
 */
export function StageCard({ index, result }: { index: number; result: StageResult<unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const [showJson, setShowJson] = useState(false);

  return (
    <Card className={!result.implemented ? "border-dashed opacity-90" : undefined}>
      <CardHeader
        className="cursor-pointer select-none flex-row items-center justify-between gap-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {index}
          </span>
          <div>
            <p className="font-semibold leading-tight">{result.stage}</p>
            {!result.implemented && (
              <p className="text-xs text-muted-foreground">Not implemented in Tasks 001–006</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={CONFIDENCE_STYLE[result.confidence]}>
            {result.confidence}
          </Badge>
          <span className="text-muted-foreground text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3 border-t pt-4 text-sm">
          <Field label="Decision" value={result.decision} mono />
          <Field label="Confidence" value={result.confidence} />
          <Field label="Reason" value={result.reason} />
          <Field label="Source" value={result.source} mono />
          {result.durationMs > 0 && <Field label="Duration" value={`${result.durationMs} ms`} />}

          {result.data !== null && (
            <div className="pt-2">
              <button
                type="button"
                className="text-xs font-medium text-primary underline underline-offset-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowJson((v) => !v);
                }}
              >
                {showJson ? "Hide raw JSON" : "Show raw JSON"}
              </button>
              {showJson && (
                <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className={mono ? "font-mono text-xs break-words" : "break-words"}>{value}</span>
    </div>
  );
}
