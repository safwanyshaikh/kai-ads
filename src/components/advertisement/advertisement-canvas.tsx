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
  const trimmed =
    header.trim();

  if (!trimmed) {
    return "RECRUITMENT CAMPAIGN";
  }

  return trimmed
    .split("—")[0]
    .trim()
    .replace(/\s+/g, " ");
}

function totalVacancies(
  positions: CreateAdvertisementInput["positions"],
): number {
  return positions.reduce(
    (sum, position) =>
      sum +
      (position.count ?? 0),
    0,
  );
}

function normaliseDisplayValue(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

export function AdvertisementCanvas({
  advertisementId,
  data,
  canEdit,
}: AdvertisementCanvasProps) {
  const router =
    useRouter();

  const [editing, setEditing] =
    useState<BlockKey | null>(
      null,
    );

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null,
    );

  const [header, setHeader] =
    useState(
      data.header,
    );

  const [employer, setEmployer] =
    useState(
      data.employer ?? "",
    );

  const [positions, setPositions] =
    useState(
      data.positions.map(
        (position) => ({
          title:
            position.title,
          count:
            position.count != null
              ? String(
                  position.count,
                )
              : "",
        }),
      ),
    );

  const [benefits, setBenefits] =
    useState(
      data.benefits.map(
        (benefit) => ({
          label:
            benefit.label,
          detail:
            benefit.detail ?? "",
        }),
      ),
    );

  const [interviewDate, setInterviewDate] =
    useState(
      data.interview.date ??
        "",
    );

  const [interviewLocation, setInterviewLocation] =
    useState(
      data.interview.location ??
        "",
    );

  const [contact, setContact] =
    useState({
      name:
        data.contact.name ??
        "",
      phone:
        data.contact.phone ??
        "",
      email:
        data.contact.email ??
        "",
      whatsapp:
        data.contact.whatsapp ??
        "",
    });

  const [footer, setFooter] =
    useState(
      data.footer ?? "",
    );

  async function save(
    patch: Partial<CreateAdvertisementInput>,
    summary: string,
  ) {
    setSaving(true);
    setError(null);

    const result =
      await patchJson(
        API_ROUTES.advertisement(
          advertisementId,
        ),
        {
          ...patch,
          changeSummary:
            summary,
        },
      );

    setSaving(false);

    if (!result.ok) {
      setError(
        result.message ??
          "Could not save this change.",
      );
      return;
    }

    setEditing(null);
    router.refresh();
  }

  function openEditor(
    key: BlockKey,
  ) {
    setError(null);
    setEditing(key);
  }

  function editableBlock(
    key: BlockKey,
    label: string,
    display: ReactNode,
    editor: ReactNode,
    className = "",
  ) {
    const isEditing =
      editing === key;

    if (!canEdit) {
      return (
        <div
          className={className}
        >
          {display}
        </div>
      );
    }

    if (isEditing) {
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
        onClick={() =>
          openEditor(key)
        }
        className={`group relative block w-full cursor-pointer text-left ${className}`}
        aria-label={`Edit ${label}`}
      >
        {display}

        <span className="pointer-events-none absolute right-3 top-3 hidden rounded bg-primary px-2 py-1 text-[10px] font-bold uppercase text-primary-foreground group-hover:block">
          Edit
        </span>
      </button>
    );
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
          {saving
            ? "Saving…"
            : "Save"}
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

  const campaignTitle =
    cleanCampaignTitle(
      data.header,
    );

  const campaignMeta =
    [
      data.country,
      data.industry,
    ]
      .filter(Boolean)
      .join(
        " · ",
      );

  const vacancyCount =
    totalVacancies(
      data.positions,
    );

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
          Click any recruitment block
          to edit it. Every save creates
          a new version.
        </p>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* CAMPAIGN SHEET                                                     */}
      {/* ------------------------------------------------------------------ */}

      <div className="overflow-hidden rounded-xl border-2 border-foreground/80 bg-white text-black shadow-sm">
        {/* --------------------------------------------------------------- */}
        {/* 01 — CAMPAIGN HEADER                                            */}
        {/* --------------------------------------------------------------- */}

        {editableBlock(
          "campaign",
          "Campaign",
          <div className="bg-[#0B1F33] px-6 py-7 text-white">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#F3D98B]">
                  Recruitment Campaign
                </p>

                <h2 className="text-3xl font-black uppercase leading-none tracking-tight">
                  {campaignTitle}
                </h2>

                <p className="mt-3 text-lg font-bold uppercase tracking-wide text-[#F3D98B]">
                  {campaignMeta ||
                    "RECRUITMENT OPPORTUNITY"}
                </p>

                <div className="mt-4 inline-flex rounded-full bg-[#F3D98B] px-4 py-2 text-sm font-black uppercase tracking-wide text-[#0B1F33]">
                  {vacancyCount > 0
                    ? `${vacancyCount} Vacancies`
                    : "Multiple Opportunities"}
                </div>
              </div>

              <div className="shrink-0 rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-center">
                <p className="text-2xl font-black">
                  {data.positions.length}
                </p>

                <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                  Roles
                </p>
              </div>
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
                {
                  header,
                },
                "Campaign headline edited on canvas",
              ),
            )}
          </div>,

          "bg-[#0B1F33]",
        )}

        {/* --------------------------------------------------------------- */}
        {/* 02 — EMPLOYER                                                   */}
        {/* --------------------------------------------------------------- */}

        {normaliseDisplayValue(
          data.employer,
        ) &&
          editableBlock(
            "employer",
            "Employer",
            <div className="border-b border-black/10 px-6 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                Hiring Company / Project Client
              </p>

              <p className="mt-1 text-base font-bold">
                {
                  data.employer
                }
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

        {/* --------------------------------------------------------------- */}
        {/* 03 — MAIN RECRUITMENT BODY                                     */}
        {/* --------------------------------------------------------------- */}

        <div className="grid lg:grid-cols-[1.6fr_0.9fr]">
          {/* ----------------------------------------------------------- */}
          {/* LEFT — POSITIONS                                            */}
          {/* ----------------------------------------------------------- */}

          {editableBlock(
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

              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {data.positions.map(
                  (
                    position,
                    index,
                  ) => (
                    <div
                      key={`${position.title}-${index}`}
                      className="flex items-start gap-3"
                    >
                      <span className="mt-0.5 min-w-9 rounded-md bg-[#F3D98B] px-2 py-1 text-center text-xs font-black text-[#0B1F33]">
                        {position.count ??
                          "—"}
                      </span>

                      <div className="min-w-0">
                        <p className="text-[15px] font-extrabold leading-tight">
                          {
                            position.title
                          }
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>,

            <div className="space-y-4">
              <div className="space-y-2">
                {positions.map(
                  (
                    position,
                    index,
                  ) => (
                    <div
                      key={index}
                      className="grid gap-2 sm:grid-cols-[1fr_100px_auto]"
                    >
                      <Input
                        value={
                          position.title
                        }
                        onChange={(
                          event,
                        ) =>
                          setPositions(
                            (
                              rows,
                            ) =>
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
                                          event
                                            .target
                                            .value,
                                      }
                                    : row,
                              ),
                            )
                          )
                        }
                        placeholder="Position"
                      />

                      <Input
                        value={
                          position.count
                        }
                        onChange={(
                          event,
                        ) =>
                          setPositions(
                            (
                              rows,
                            ) =>
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
                                          event
                                            .target
                                            .value,
                                      }
                                    : row,
                              ),
                            )
                          )
                        }
                        placeholder="Count"
                      />

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setPositions(
                            (
                              rows,
                            ) =>
                              rows.filter(
                                (
                                  _,
                                  rowIndex,
                                ) =>
                                  rowIndex !==
                                  index,
                              ),
                            )
                          )
                        }
                        disabled={
                          positions.length <=
                          1
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ),
                )}
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setPositions(
                    (rows) => [
                      ...rows,
                      {
                        title:
                          "",
                        count:
                          "",
                      },
                    ],
                  )
                }
              >
                Add Position
              </Button>

              {editActions(() =>
                save(
                  {
                    positions:
                      positions
                        .filter(
                          (
                            position,
                          ) =>
                            position.title.trim()
                              .length >
                            0,
                        )
                        .map(
                          (
                            position,
                          ) => ({
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

            "min-h-[340px]",
          )}

          {/* ----------------------------------------------------------- */}
          {/* RIGHT — CANDIDATE ACTION                                    */}
          {/* ----------------------------------------------------------- */}

          <div className="bg-[#F5F1E8]">
            <div className="px-6 py-6">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
                Candidate Action
              </p>

              <h3 className="mt-1 text-2xl font-black uppercase tracking-tight">
                What You Need to Know
              </h3>
            </div>

            <div className="divide-y divide-black/10">
              {/* BENEFITS */}
              {editableBlock(
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
                          <div
                            key={
                              `${benefit.label}-${index}`
                            }
                            className="flex items-start gap-2 text-sm"
                          >
                            <span className="mt-0.5 text-[#0B1F33]">
                              •
                            </span>

                            <p className="font-semibold">
                              {
                                benefit.label
                              }
                              {benefit.detail
                                ? ` — ${benefit.detail}`
                                : ""}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No benefits supplied
                      in the recruitment
                      requirement.
                    </p>
                  )}
                </div>,

                <div className="space-y-3">
                  <div className="space-y-2">
                    {benefits.map(
                      (
                        benefit,
                        index,
                      ) => (
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
                            ) =>
                              setBenefits(
                                (
                                  rows,
                                ) =>
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
                                              event
                                                .target
                                                .value,
                                          }
                                        : row,
                                  ),
                                )
                              )
                            }
                            placeholder="Benefit"
                          />

                          <Input
                            value={
                              benefit.detail
                            }
                            onChange={(
                              event,
                            ) =>
                              setBenefits(
                                (
                                  rows,
                                ) =>
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
                                              event
                                                .target
                                                .value,
                                          }
                                        : row,
                                  ),
                                )
                              )
                            }
                            placeholder="Detail"
                          />

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setBenefits(
                                (
                                  rows,
                                ) =>
                                  rows.filter(
                                    (
                                      _,
                                      rowIndex,
                                    ) =>
                                      rowIndex !==
                                      index,
                                  ),
                                )
                              )
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      ),
                    )}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setBenefits(
                        (rows) => [
                          ...rows,
                          {
                            label:
                              "",
                            detail:
                              "",
                          },
                        ],
                      )
                    }
                  >
                    Add Benefit
                  </Button>

                  {editActions(() =>
                    save(
                      {
                        benefits:
                          benefits
                            .filter(
                              (
                                benefit,
                              ) =>
                                benefit.label.trim()
                                  .length >
                                0,
                            )
                            .map(
                              (
                                benefit,
                              ) => ({
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

                "bg-transparent",
              )}

              {/* INTERVIEW */}
              {editableBlock(
                "interview",
                "Interview",
                <div className="px-6 py-5">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-[#0B1F33]">
                    Interview
                  </p>

                  {data.interview.date ||
                  data.interview.location ? (
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
                      Interview details
                      not yet supplied.
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
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="Interview location"
                    />
                  </div>

                  {editActions(() =>
                    save(
                      {
                        interview:
                          {
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
              {editableBlock(
                "contact",
                "Apply",
                <div className="px-6 py-5">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-[#0B1F33]">
                    Apply / Contact
                  </p>

                  {contact.email ||
                  contact.phone ||
                  contact.whatsapp ? (
                    <div className="mt-3 space-y-1">
                      {contact.email && (
                        <p className="break-all text-base font-black">
                          {
                            contact.email
                          }
                        </p>
                      )}

                      {contact.phone && (
                        <p className="text-sm font-semibold">
                          {
                            contact.phone
                          }
                        </p>
                      )}

                      {contact.whatsapp && (
                        <p className="text-sm font-semibold">
                          WhatsApp:{" "}
                          {
                            contact.whatsapp
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
                              event
                                .target
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
                              event
                                .target
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
                              event
                                .target
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
                              event
                                .target
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
                        contact:
                          {
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

        {/* --------------------------------------------------------------- */}
        {/* 04 — TRUST FOOTER                                              */}
        {/* --------------------------------------------------------------- */}

        {editableBlock(
          "footer",
          "Footer",
          <div className="border-t-4 border-[#F3D98B] bg-[#0B1F33] px-6 py-5 text-white">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F3D98B]">
                  Agency Trust
                </p>

                <p className="mt-1 text-lg font-black uppercase">
                  {data.footer ||
                    "AL YOUSUF ENTERPRISES LLP"}
                </p>

                <p className="mt-1 text-xs text-white/70">
                  Logo, registration and
                  verification are controlled
                  by the Agency profile.
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xs font-bold uppercase tracking-wider text-white/70">
                  Verification
                </p>

                <p className="mt-1 text-sm font-bold">
                  QR protected
                </p>
              </div>
            </div>
          </div>,

          <div className="space-y-3">
            <Textarea
              value={
                footer
              }
              onChange={(
                event,
              ) =>
                setFooter(
                  event.target
                    .value,
                )
              }
              rows={2}
              placeholder="Optional source-grounded footer line"
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

        {/* --------------------------------------------------------------- */}
        {/* TRUST ELEMENTS — LOCKED                                       */}
        {/* --------------------------------------------------------------- */}

        <div className="flex flex-col gap-3 bg-muted/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Agency Logo & Verification QR
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              These trust elements are
              automatically applied to every
              generated advertisement. They
              are never freely editable.
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
