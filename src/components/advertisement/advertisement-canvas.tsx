"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

import {
  API_ROUTES,
  APP_ROUTES,
} from "@/lib/constants";
import { displayTitle } from "@/lib/display-title";

import { patchJson } from "@/lib/api-client";
import type { CreateAdvertisementInput } from "@/lib/validations/advertisement";

type BlockKey =
  | "campaign"
  | "employer"
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

function cleanCampaignTitle(
  header: string,
): string {
  const value = header
    .trim()
    .split("—")[0]
    .trim();

  return value || "RECRUITMENT CAMPAIGN";
}

function totalVacancies(
  positions: CreateAdvertisementInput["positions"],
): number {
  return positions.reduce(
    (sum, position) =>
      sum + (position.count ?? 0),
    0,
  );
}

function hasValue(
  value: string | null | undefined,
): boolean {
  return Boolean(value?.trim());
}

export function AdvertisementCanvas({
  advertisementId,
  data,
  canEdit,
}: AdvertisementCanvasProps) {
  const router = useRouter();

  const [editing, setEditing] =
    useState<BlockKey | null>(null);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [header, setHeader] =
    useState(data.header);

  const [employer, setEmployer] =
    useState(data.employer ?? "");

  const [positions, setPositions] =
    useState(
      data.positions.map((position) => ({
        title: position.title,
        count:
          position.count == null
            ? ""
            : String(position.count),
      })),
    );

  const [benefits, setBenefits] =
    useState(
      data.benefits.map((benefit) => ({
        label: benefit.label,
        detail: benefit.detail ?? "",
      })),
    );

  const [interviewDate, setInterviewDate] =
    useState(
      data.interview.date ?? "",
    );

  const [interviewLocation, setInterviewLocation] =
    useState(
      data.interview.location ?? "",
    );

  const [contact, setContact] =
    useState({
      name: data.contact.name ?? "",
      phone: data.contact.phone ?? "",
      email: data.contact.email ?? "",
      whatsapp:
        data.contact.whatsapp ?? "",
    });

  const [footer, setFooter] =
    useState(data.footer ?? "");

  async function save(
    patch: Partial<CreateAdvertisementInput>,
    summary: string,
  ) {
    setSaving(true);
    setError(null);

    try {
      const result =
        await patchJson(
          API_ROUTES.advertisement(
            advertisementId,
          ),
          {
            ...patch,
            changeSummary: summary,
          },
        );

      if (!result.ok) {
        setError(
          result.message ??
            "Could not save this change.",
        );
        return;
      }

      setEditing(null);
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this change.",
      );
    } finally {
      setSaving(false);
    }
  }

  function editActions(
    onSave: () => void,
  ) {
    return (
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setEditing(null)
          }
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    );
  }

  function block(
    key: BlockKey,
    label: string,
    display: ReactNode,
    editor: ReactNode,
    className = "",
  ) {
    if (!canEdit) {
      return (
        <div className={className}>
          {display}
        </div>
      );
    }

    if (editing === key) {
      return (
        <div
          className={`space-y-4 border-2 border-primary bg-primary/5 p-5 ${className}`}
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-extrabold uppercase tracking-wider text-primary">
              {label}
            </p>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                setEditing(null)
              }
              disabled={saving}
            >
              Cancel
            </Button>
          </div>

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
        className={`group relative block w-full text-left ${className}`}
        aria-label={`Edit ${label}`}
      >
        {display}

        <span className="pointer-events-none absolute right-3 top-3 hidden rounded bg-primary px-2 py-1 text-[10px] font-bold uppercase text-primary-foreground group-hover:block">
          Edit
        </span>
      </button>
    );
  }

  const campaignTitle =
    cleanCampaignTitle(
      data.header,
    );

  const campaignMeta =
    [data.country, data.industry]
      .filter(Boolean)
      .join(" · ");

  const vacancies =
    totalVacancies(
      data.positions,
    );

  const contactPresent =
    hasValue(data.contact.email) ||
    hasValue(data.contact.phone) ||
    hasValue(data.contact.whatsapp);

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>
            Could not save
          </AlertTitle>

          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {canEdit && (
        <p className="text-sm text-muted-foreground">
          Click any recruitment block to
          edit it. Every save creates a new
          version.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border-2 border-foreground/80 bg-white text-black shadow-sm">
        {/* ---------------------------------------------------------------- */}
        {/* CAMPAIGN HEADER                                                   */}
        {/* ---------------------------------------------------------------- */}

        {block(
          "campaign",
          "Campaign",
          <div className="bg-[#0B1F33] px-6 py-7 text-white">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#F3D98B]">
              Recruitment Campaign
            </p>

            <h2 className="text-3xl font-black uppercase leading-none tracking-tight">
              {campaignTitle}
            </h2>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {campaignMeta && (
                <p className="text-lg font-bold uppercase tracking-wide text-[#F3D98B]">
                  {campaignMeta}
                </p>
              )}

              {vacancies > 0 && (
                <span className="rounded-full bg-[#F3D98B] px-4 py-2 text-sm font-black uppercase text-[#0B1F33]">
                  {vacancies} Vacancies
                </span>
              )}

              <span className="rounded-full border border-white/25 px-4 py-2 text-sm font-black uppercase">
                {data.positions.length}{" "}
                {data.positions.length === 1
                  ? "Role"
                  : "Roles"}
              </span>
            </div>
          </div>,

          <div className="space-y-3">
            <Input
              value={header}
              onChange={(event) =>
                setHeader(
                  event.target.value,
                )
              }
              placeholder="Campaign headline"
            />

            {editActions(() =>
              save(
                { header },
                "Campaign headline edited on canvas",
              ),
            )}
          </div>,

          "bg-[#0B1F33]",
        )}

        {/* ---------------------------------------------------------------- */}
        {/* CONFIRMED EMPLOYER — ONLY WHEN ACTUALLY PRESENT                   */}
        {/* ---------------------------------------------------------------- */}

        {hasValue(data.employer) &&
          block(
            "employer",
            "Employer",
            <div className="border-b border-black/10 px-6 py-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                Hiring Company / Project Client
              </p>

              <p className="mt-1 text-lg font-bold">
                {data.employer}
              </p>
            </div>,

            <div className="space-y-3">
              <Input
                value={employer}
                onChange={(event) =>
                  setEmployer(
                    event.target.value,
                  )
                }
                placeholder="Confirmed employer / client"
              />

              {editActions(() =>
                save(
                  {
                    employer:
                      employer.trim() ||
                      undefined,
                  },
                  "Employer edited on canvas",
                ),
              )}
            </div>,

            "border-b border-black/10",
          )}

        {/* ---------------------------------------------------------------- */}
        {/* MAIN RECRUITMENT AREA                                             */}
        {/* ---------------------------------------------------------------- */}

        <div className="grid lg:grid-cols-[1.65fr_0.9fr]">
          {/* ============================================================= */}
          {/* POSITIONS                                                       */}
          {/* ============================================================= */}

          {block(
            "positions",
            "Positions",
            <div className="border-b border-black/10 px-6 py-6 lg:border-b-0 lg:border-r">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
                    Recruitment
                  </p>

                  <h3 className="mt-1 text-2xl font-black uppercase tracking-tight">
                    Available Positions
                  </h3>
                </div>

                <div className="shrink-0 rounded-md bg-[#F3D98B] px-3 py-2 text-center">
                  <p className="text-lg font-black leading-none">
                    {data.positions.length}
                  </p>

                  <p className="text-[9px] font-bold uppercase tracking-wide text-[#0B1F33]">
                    Roles
                  </p>
                </div>
              </div>

              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {data.positions.map(
                  (position, index) => (
                    <div
                      key={`${position.title}-${index}`}
                      className="flex items-start gap-3"
                    >
                      <span className="mt-0.5 min-w-10 rounded-md bg-[#F3D98B] px-2 py-1 text-center text-xs font-black text-[#0B1F33]">
                        {position.count ??
                          "—"}
                      </span>

                      {/* Display-only correction, exactly as the generated
                          advertisement typesets it — the stored fact this
                          reads from is never rewritten. */}
                      <p className="min-w-0 text-[15px] font-extrabold leading-tight">
                        {displayTitle(
                          position.title,
                        )}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>,

            <div className="space-y-4">
              {positions.map(
                (position, index) => (
                  <div
                    key={index}
                    className="space-y-2 rounded-md border p-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-[1fr_100px_auto]">
                      <Input
                        value={
                          position.title
                        }
                        onChange={(
                          event,
                        ) => {
                          const next =
                            event.target
                              .value;

                          setPositions(
                            (rows) =>
                              rows.map(
                                (
                                  row,
                                  rowIndex,
                                ) =>
                                  rowIndex ===
                                  index
                                    ? {
                                        ...row,
                                        title:
                                          next,
                                      }
                                    : row,
                              ),
                          );
                        }}
                        placeholder="Position"
                      />

                      <Input
                        value={
                          position.count
                        }
                        onChange={(
                          event,
                        ) => {
                          const next =
                            event.target
                              .value;

                          setPositions(
                            (rows) =>
                              rows.map(
                                (
                                  row,
                                  rowIndex,
                                ) =>
                                  rowIndex ===
                                  index
                                    ? {
                                        ...row,
                                        count:
                                          next,
                                      }
                                    : row,
                              ),
                          );
                        }}
                        placeholder="Count"
                      />

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPositions(
                            (rows) =>
                              rows.filter(
                                (
                                  _row,
                                  rowIndex,
                                ) =>
                                  rowIndex !==
                                  index,
                              ),
                          );
                        }}
                        disabled={
                          positions.length <=
                          1
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ),
              )}

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setPositions(
                    (rows) => [
                      ...rows,
                      {
                        title: "",
                        count: "",
                      },
                    ],
                  );
                }}
              >
                Add Position
              </Button>

              {editActions(() =>
                save(
                  {
                    positions:
                      positions
                        .filter(
                          (position) =>
                            position.title.trim()
                              .length >
                            0,
                        )
                        .map(
                          (position) => ({
                            title:
                              position.title.trim(),
                            count:
                              position.count.trim()
                                ? Number(
                                    position.count,
                                  )
                                : undefined,
                          }),
                        ),
                  },
                  "Positions edited on canvas",
                ),
              )}
            </div>,

            "min-h-[360px]",
          )}

          {/* ============================================================= */}
          {/* CANDIDATE ACTION                                                */}
          {/* ============================================================= */}

          <div className="bg-[#F5F1E8]">
            <div className="px-6 py-6">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
                Candidate Action
              </p>

              <h3 className="mt-1 text-2xl font-black uppercase tracking-tight">
                Important Details
              </h3>
            </div>

            <div className="divide-y divide-black/10">
              {/* BENEFITS */}
              {block(
                "benefits",
                "Benefits",
                <div className="px-6 py-5">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-[#0B1F33]">
                    Benefits
                  </p>

                  {data.benefits.length >
                  0 ? (
                    <div className="mt-3 space-y-2">
                      {data.benefits.map(
                        (
                          benefit,
                          index,
                        ) => (
                          <p
                            key={`${benefit.label}-${index}`}
                            className="text-sm font-semibold"
                          >
                            •{" "}
                            {
                              benefit.label
                            }
                            {benefit.detail
                              ? ` — ${benefit.detail}`
                              : ""}
                          </p>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No benefits supplied
                      in the requirement.
                    </p>
                  )}
                </div>,

                <div className="space-y-3">
                  {benefits.map(
                    (benefit, index) => (
                      <div
                        key={index}
                        className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                      >
                        <Input
                          value={
                            benefit.label
                          }
                          onChange={(
                            event,
                          ) => {
                            const next =
                              event
                                .target
                                .value;

                            setBenefits(
                              (rows) =>
                                rows.map(
                                  (
                                    row,
                                    rowIndex,
                                  ) =>
                                    rowIndex ===
                                    index
                                      ? {
                                          ...row,
                                          label:
                                            next,
                                        }
                                      : row,
                                ),
                            );
                          }}
                          placeholder="Benefit"
                        />

                        <Input
                          value={
                            benefit.detail
                          }
                          onChange={(
                            event,
                          ) => {
                            const next =
                              event
                                .target
                                .value;

                            setBenefits(
                              (rows) =>
                                rows.map(
                                  (
                                    row,
                                    rowIndex,
                                  ) =>
                                    rowIndex ===
                                    index
                                      ? {
                                          ...row,
                                          detail:
                                            next,
                                        }
                                      : row,
                                ),
                            );
                          }}
                          placeholder="Detail"
                        />

                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setBenefits(
                              (rows) =>
                                rows.filter(
                                  (
                                    _row,
                                    rowIndex,
                                  ) =>
                                    rowIndex !==
                                    index,
                                ),
                            );
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ),
                  )}

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBenefits(
                        (rows) => [
                          ...rows,
                          {
                            label: "",
                            detail: "",
                          },
                        ],
                      );
                    }}
                  >
                    Add Benefit
                  </Button>

                  {editActions(() =>
                    save(
                      {
                        benefits:
                          benefits
                            .filter(
                              (benefit) =>
                                benefit.label.trim()
                                  .length >
                                0,
                            )
                            .map(
                              (benefit) => ({
                                label:
                                  benefit.label.trim(),
                                detail:
                                  benefit.detail.trim() ||
                                  undefined,
                              }),
                            ),
                      },
                      "Benefits edited on canvas",
                    ),
                  )}
                </div>,
              )}

              {/* INTERVIEW */}
              {block(
                "interview",
                "Interview",
                <div className="px-6 py-5">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-[#0B1F33]">
                    Interview
                  </p>

                  {hasValue(
                    data.interview.date,
                  ) ||
                  hasValue(
                    data.interview.location,
                  ) ? (
                    <p className="mt-2 text-sm font-bold">
                      {
                        data.interview
                          .date
                      }

                      {data.interview
                        .date &&
                      data.interview
                        .location
                        ? " · "
                        : ""}

                      {
                        data.interview
                          .location
                      }
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Interview details not
                      yet supplied.
                    </p>
                  )}
                </div>,

                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={
                        interviewDate
                      }
                      onChange={(
                        event,
                      ) =>
                        setInterviewDate(
                          event.target
                            .value,
                        )
                      }
                      placeholder="Interview date"
                    />

                    <Input
                      value={
                        interviewLocation
                      }
                      onChange={(
                        event,
                      ) =>
                        setInterviewLocation(
                          event.target
                            .value,
                        )
                      }
                      placeholder="Interview location"
                    />
                  </div>

                  {editActions(() =>
                    save(
                      {
                        interview: {
                          ...data.interview,
                          date:
                            interviewDate.trim() ||
                            undefined,
                          location:
                            interviewLocation.trim() ||
                            undefined,
                        },
                      },
                      "Interview edited on canvas",
                    ),
                  )}
                </div>,
              )}

              {/* APPLY / CONTACT */}
              {block(
                "contact",
                "Apply",
                <div className="px-6 py-5">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-[#0B1F33]">
                    Apply / Contact
                  </p>

                  {contactPresent ? (
                    <div className="mt-3 space-y-1">
                      {contact.email && (
                        <p className="break-all text-base font-black">
                          {
                            data.contact
                              .email
                          }
                        </p>
                      )}

                      {contact.phone && (
                        <p className="text-sm font-semibold">
                          {
                            data.contact
                              .phone
                          }
                        </p>
                      )}

                      {contact.whatsapp && (
                        <p className="text-sm font-semibold">
                          WhatsApp:{" "}
                          {
                            data.contact
                              .whatsapp
                          }
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No contact details
                      supplied.
                    </p>
                  )}
                </div>,

                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={
                        contact.name
                      }
                      onChange={(
                        event,
                      ) =>
                        setContact(
                          (current) => ({
                            ...current,
                            name:
                              event.target
                                .value,
                          }),
                        )
                      }
                      placeholder="Contact name"
                    />

                    <Input
                      value={
                        contact.phone
                      }
                      onChange={(
                        event,
                      ) =>
                        setContact(
                          (current) => ({
                            ...current,
                            phone:
                              event.target
                                .value,
                          }),
                        )
                      }
                      placeholder="Phone"
                    />

                    <Input
                      value={
                        contact.email
                      }
                      onChange={(
                        event,
                      ) =>
                        setContact(
                          (current) => ({
                            ...current,
                            email:
                              event.target
                                .value,
                          }),
                        )
                      }
                      placeholder="Email"
                    />

                    <Input
                      value={
                        contact.whatsapp
                      }
                      onChange={(
                        event,
                      ) =>
                        setContact(
                          (current) => ({
                            ...current,
                            whatsapp:
                              event.target
                                .value,
                          }),
                        )
                      }
                      placeholder="WhatsApp"
                    />
                  </div>

                  {editActions(() =>
                    save(
                      {
                        contact: {
                          name:
                            contact.name.trim() ||
                            undefined,
                          phone:
                            contact.phone.trim() ||
                            undefined,
                          email:
                            contact.email.trim() ||
                            undefined,
                          whatsapp:
                            contact.whatsapp.trim() ||
                            undefined,
                        },
                      },
                      "Contact edited on canvas",
                    ),
                  )}
                </div>,
              )}
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* TRUST FOOTER                                                     */}
        {/* ---------------------------------------------------------------- */}

        {block(
          "footer",
          "Footer",
          <div className="border-t-4 border-[#F3D98B] bg-[#0B1F33] px-6 py-5 text-white">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F3D98B]">
              Agency Trust
            </p>

            {/*
              KAI Ads is multi-tenant: the agency identity on a generated
              advertisement is resolved at render time from the Agency
              profile, which this preview component does not receive. A
              hardcoded agency name here rendered ONE tenant's identity as
              the Agency Trust line of EVERY other tenant's advertisement —
              a false identity claim on a regulated instrument. No tenant
              name may ever be a fallback.
            */}
            {hasValue(data.footer) ? (
              <p className="mt-1 text-lg font-black uppercase">
                {data.footer}
              </p>
            ) : (
              <p className="mt-1 text-sm font-semibold italic text-white/60">
                Your agency identity is applied
                automatically from your Agency
                profile.
              </p>
            )}

            <p className="mt-1 text-xs text-white/70">
              Agency identity, registration
              and verification are controlled
              by the Agency profile.
            </p>
          </div>,

          <div className="space-y-3">
            <Textarea
              value={footer}
              onChange={(event) =>
                setFooter(
                  event.target.value,
                )
              }
              rows={2}
              placeholder="Optional source-grounded footer"
            />

            {editActions(() =>
              save(
                {
                  footer:
                    footer.trim() ||
                    undefined,
                },
                "Footer edited on canvas",
              ),
            )}
          </div>,

          "bg-[#0B1F33]",
        )}

        {/* ---------------------------------------------------------------- */}
        {/* LOCKED TRUST ELEMENTS                                            */}
        {/* ---------------------------------------------------------------- */}

        <div className="flex flex-col gap-3 bg-muted/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Agency Logo & Verification QR
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              These trust elements are applied
              automatically to generated
              advertisements and are not freely
              editable.
            </p>

            <Link
              href={
                APP_ROUTES.dashboardAgency
              }
              className="mt-1 inline-block text-xs font-semibold underline"
            >
              Manage Agency Profile
            </Link>
          </div>

          <span className="shrink-0 rounded border px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            Locked
          </span>
        </div>
      </div>
    </div>
  );
}
