"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { API_ROUTES, APP_ROUTES } from "@/lib/constants";
import { patchJson } from "@/lib/api-client";
import type { CreateAdvertisementInput } from "@/lib/validations/advertisement";

/**
 * Advertisement Canvas (Sprint 006 workflow replacement).
 *
 * The generated advertisement IS the editor: there is no data-entry form
 * after AI extraction. Every block below is the advertisement's own
 * content, clickable in place — click a block, edit exactly that block,
 * save. Each save goes through PATCH /api/advertisements/[id] (the same
 * versioned update path as every other edit in the app), so every canvas
 * edit is a real version with history, never a local-only change.
 *
 * Blocks that are LAW, not content — the verification QR (always the
 * KAI-controlled /v/ route, Advertisement Composition Constitution) and
 * the agency logo (tenant identity, managed on the Agency profile) — are
 * shown as locked blocks that explain themselves instead of opening an
 * editor. Clicking them never offers a way to fabricate or override
 * trust elements.
 */

type BlockKey =
  | "header"
  | "employer"
  | "countryIndustry"
  | "positions"
  | "benefits"
  | "interview"
  | "contact"
  | "footer";

interface AdvertisementCanvasProps {
  advertisementId: string;
  data: CreateAdvertisementInput;
  canEdit: boolean;
}

export function AdvertisementCanvas({ advertisementId, data, canEdit }: AdvertisementCanvasProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<BlockKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-block draft state, seeded from the advertisement itself.
  const [header, setHeader] = useState(data.header);
  const [employer, setEmployer] = useState(data.employer ?? "");
  const [country, setCountry] = useState(data.country);
  const [industry, setIndustry] = useState(data.industry);
  const [positions, setPositions] = useState(
    data.positions.map((p) => ({ title: p.title, count: p.count != null ? String(p.count) : "" })),
  );
  const [benefits, setBenefits] = useState(
    data.benefits.map((b) => ({ label: b.label, detail: b.detail ?? "" })),
  );
  const [interviewDate, setInterviewDate] = useState(data.interview.date ?? "");
  const [interviewLocation, setInterviewLocation] = useState(data.interview.location ?? "");
  const [contact, setContact] = useState({
    name: data.contact.name ?? "",
    phone: data.contact.phone ?? "",
    email: data.contact.email ?? "",
    whatsapp: data.contact.whatsapp ?? "",
  });
  const [footer, setFooter] = useState(data.footer ?? "");

  async function save(patch: Partial<CreateAdvertisementInput>, summary: string) {
    setSaving(true);
    setError(null);
    const result = await patchJson(API_ROUTES.advertisement(advertisementId), {
      ...patch,
      changeSummary: summary,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? "Could not save this block");
      return;
    }
    setEditing(null);
    router.refresh();
  }

  function block(key: BlockKey, label: string, display: ReactNode, editor: ReactNode) {
    const isEditing = editing === key;
    if (!canEdit) return <div className="px-6 py-3">{display}</div>;
    if (isEditing) {
      return (
        <div className="space-y-3 border-2 border-primary bg-muted/30 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</p>
          {editor}
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setEditing(key);
        }}
        className="group relative block w-full cursor-pointer px-6 py-3 text-left transition-colors hover:bg-primary/5"
        aria-label={`Edit ${label}`}
      >
        {display}
        <span className="absolute right-2 top-2 hidden rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground group-hover:inline">
          Edit {label}
        </span>
      </button>
    );
  }

  const editActions = (onSave: () => void) => (
    <div className="flex gap-2">
      <Button size="sm" onClick={onSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
      <Button size="sm" variant="outline" onClick={() => setEditing(null)} disabled={saving}>
        Cancel
      </Button>
    </div>
  );

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {canEdit && (
        <p className="text-sm text-muted-foreground">
          Click any block of the advertisement to edit it in place. Every save is a new version.
        </p>
      )}

      {/* The canvas sheet — white page, black ink, per the DTP house grammar. */}
      <div className="divide-y overflow-hidden rounded-lg border-2 border-foreground/80 bg-white text-black shadow-sm">
        {/* HEADER */}
        {block(
          "header",
          "Header",
          <h2 className="text-2xl font-extrabold uppercase leading-tight tracking-tight">
            {data.header || <span className="text-muted-foreground">(No header)</span>}
          </h2>,
          <>
            <Input value={header} onChange={(e) => setHeader(e.target.value)} />
            {editActions(() => save({ header }, "Header edited on canvas"))}
          </>,
        )}

        {/* EMPLOYER */}
        {block(
          "employer",
          "Employer",
          <p className="text-lg font-bold">
            {data.employer || <span className="text-sm font-normal text-muted-foreground">No employer named — click to add</span>}
          </p>,
          <>
            <Input
              value={employer}
              onChange={(e) => setEmployer(e.target.value)}
              placeholder="Employer / client company"
            />
            {editActions(() => save({ employer }, "Employer edited on canvas"))}
          </>,
        )}

        {/* COUNTRY + INDUSTRY */}
        {block(
          "countryIndustry",
          "Country & Industry",
          <p className="text-sm font-semibold uppercase tracking-wide">
            {data.country || "—"} · {data.industry || "—"}
          </p>,
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" />
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry" />
            </div>
            {editActions(() => save({ country, industry }, "Country/industry edited on canvas"))}
          </>,
        )}

        {/* POSITIONS */}
        {block(
          "positions",
          "Positions",
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Positions</p>
            {data.positions.map((position, i) => (
              <p key={i} className="text-sm font-semibold">
                ▸ {position.title}
                {position.count ? ` — ${position.count} Nos` : ""}
              </p>
            ))}
          </div>,
          <>
            <div className="space-y-2">
              {positions.map((position, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    className="flex-1"
                    value={position.title}
                    onChange={(e) =>
                      setPositions((rows) => rows.map((r, j) => (j === i ? { ...r, title: e.target.value } : r)))
                    }
                    placeholder="Position title"
                  />
                  <Input
                    className="w-24"
                    value={position.count}
                    onChange={(e) =>
                      setPositions((rows) => rows.map((r, j) => (j === i ? { ...r, count: e.target.value } : r)))
                    }
                    placeholder="Count"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPositions((rows) => rows.filter((_, j) => j !== i))}
                    disabled={positions.length <= 1}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setPositions((rows) => [...rows, { title: "", count: "" }])}>
                Add Position
              </Button>
            </div>
            {editActions(() =>
              save(
                {
                  positions: positions
                    .filter((p) => p.title.trim().length > 0)
                    .map((p) => ({
                      title: p.title.trim(),
                      count: p.count.trim() ? Number(p.count) : undefined,
                    })),
                },
                "Positions edited on canvas",
              ),
            )}
          </>,
        )}

        {/* SALARY & BENEFITS */}
        {block(
          "benefits",
          "Salary & Benefits",
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Salary & Benefits</p>
            {data.benefits.length === 0 && (
              <p className="text-sm text-muted-foreground">No benefits listed — click to add</p>
            )}
            {data.benefits.map((benefit, i) => (
              <p key={i} className="text-sm">
                • {benefit.label}
                {benefit.detail ? ` — ${benefit.detail}` : ""}
              </p>
            ))}
          </div>,
          <>
            <div className="space-y-2">
              {benefits.map((benefit, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    className="flex-1"
                    value={benefit.label}
                    onChange={(e) =>
                      setBenefits((rows) => rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))
                    }
                    placeholder="Benefit (e.g. Basic Salary)"
                  />
                  <Input
                    className="w-40"
                    value={benefit.detail}
                    onChange={(e) =>
                      setBenefits((rows) => rows.map((r, j) => (j === i ? { ...r, detail: e.target.value } : r)))
                    }
                    placeholder="Detail (e.g. SR 300)"
                  />
                  <Button size="sm" variant="ghost" onClick={() => setBenefits((rows) => rows.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setBenefits((rows) => [...rows, { label: "", detail: "" }])}>
                Add Benefit
              </Button>
            </div>
            {editActions(() =>
              save(
                {
                  benefits: benefits
                    .filter((b) => b.label.trim().length > 0)
                    .map((b) => ({ label: b.label.trim(), detail: b.detail.trim() || undefined })),
                },
                "Benefits edited on canvas",
              ),
            )}
          </>,
        )}

        {/* INTERVIEW */}
        {block(
          "interview",
          "Interview",
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Interview</p>
            {data.interview.date || data.interview.location ? (
              <p className="text-sm font-semibold">
                {data.interview.date}
                {data.interview.date && data.interview.location ? " · " : ""}
                {data.interview.location}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Shortlisting in progress — click to add interview details</p>
            )}
          </div>,
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={interviewDate}
                onChange={(e) => setInterviewDate(e.target.value)}
                placeholder="Date (e.g. 1 Aug 2026)"
              />
              <Input
                value={interviewLocation}
                onChange={(e) => setInterviewLocation(e.target.value)}
                placeholder="Venue / city"
              />
            </div>
            {editActions(() =>
              save(
                {
                  interview: {
                    ...data.interview,
                    date: interviewDate.trim() || undefined,
                    location: interviewLocation.trim() || undefined,
                  },
                },
                "Interview edited on canvas",
              ),
            )}
          </>,
        )}

        {/* CONTACT */}
        {block(
          "contact",
          "Contact",
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Contact</p>
            {contactSummary(data.contact) || (
              <p className="text-sm text-muted-foreground">No contact details — click to add</p>
            )}
          </div>,
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={contact.name}
                onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                placeholder="Contact name"
              />
              <Input
                value={contact.phone}
                onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                placeholder="Phone"
              />
              <Input
                value={contact.email}
                onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                placeholder="Email"
              />
              <Input
                value={contact.whatsapp}
                onChange={(e) => setContact((c) => ({ ...c, whatsapp: e.target.value }))}
                placeholder="WhatsApp"
              />
            </div>
            {editActions(() =>
              save(
                {
                  contact: {
                    name: contact.name.trim() || undefined,
                    phone: contact.phone.trim() || undefined,
                    email: contact.email.trim() || undefined,
                    whatsapp: contact.whatsapp.trim() || undefined,
                  },
                },
                "Contact edited on canvas",
              ),
            )}
          </>,
        )}

        {/* FOOTER */}
        {block(
          "footer",
          "Footer",
          <p className="text-xs text-muted-foreground">
            {data.footer || "No footer / registration line — click to add"}
          </p>,
          <>
            <Textarea value={footer} onChange={(e) => setFooter(e.target.value)} rows={2} />
            {editActions(() => save({ footer }, "Footer edited on canvas"))}
          </>,
        )}

        {/* TRUST ELEMENTS — locked by the Composition Constitution, never free-editable. */}
        <div className="flex items-start justify-between gap-4 bg-muted/40 px-6 py-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Agency Logo & Verification QR</p>
            <p className="text-xs text-muted-foreground">
              These trust elements are placed automatically on every generated advertisement. The QR always
              encodes KAI&apos;s own verification page for this advertisement — it is never editable. The
              agency logo comes from your{" "}
              <Link href={APP_ROUTES.dashboardAgency} className="underline">
                Agency profile
              </Link>
              .
            </p>
          </div>
          <span className="shrink-0 rounded border px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
            Locked
          </span>
        </div>
      </div>
    </div>
  );
}

function contactSummary(contact: CreateAdvertisementInput["contact"]): string | null {
  const parts = [contact.name, contact.phone, contact.email, contact.whatsapp].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
