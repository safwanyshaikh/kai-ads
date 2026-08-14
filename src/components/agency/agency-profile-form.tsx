"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
} from "@/components/ui/button";
import {
  Input,
} from "@/components/ui/input";
import {
  Textarea,
} from "@/components/ui/textarea";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Badge,
} from "@/components/ui/badge";

/**
 * Agency Profile
 *
 * This is the permanent agency identity used across advertisements.
 *
 * IMPORTANT SEPARATION:
 *
 * Agency Profile:
 *   - agency identity
 *   - official contact
 *   - registered address
 *   - credentials
 *
 * Advertisement:
 *   - campaign contact
 *   - interview venue
 *   - recruitment content
 *
 * Interview venue and campaign contact must never be stored here.
 */

export interface AgencyProfileValues {
  logoUrl: string;

  contactPerson: string;

  phone: string;

  whatsapp: string;

  officialEmail: string;

  website: string;

  officeAddress: string;

  /**
   * Optional secondary logo.
   *
   * Used for an approved ISO/certification identity.
   */
  secondaryLogoUrl: string;

  /**
   * Approved permanent agency claims.
   *
   * Stored using the existing agency brandBadges field.
   */
  brandBadges: string;
}

export interface AgencyProfileFormProps {
  initial: AgencyProfileValues;

  agencyName: string;

  registrationNumber: string;

  agencyStatus:
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "SUSPENDED";

  verificationStatus?:
    | "UNVERIFIED"
    | "VERIFIED"
    | "SUSPENDED"
    | "REVERIFICATION_REQUIRED";
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
}: {
  label: string;

  name: keyof AgencyProfileValues;

  value: string;

  onChange: (
    name: keyof AgencyProfileValues,
    value: string,
  ) => void;

  placeholder?: string;

  hint?: string;

  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        className="text-sm font-semibold"
        htmlFor={name}
      >
        {label}
      </label>

      <Input
        id={name}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            name,
            event.target.value,
          )
        }
      />

      {hint && (
        <p className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function statusLabel(
  value:
    | string
    | undefined,
): string {
  if (!value) {
    return "NOT AVAILABLE";
  }

  return value.replace(
    /_/g,
    " ",
  );
}

export function AgencyProfileForm({
  initial,
  agencyName,
  registrationNumber,
  agencyStatus,
  verificationStatus,
}: AgencyProfileFormProps) {
  const router =
    useRouter();

  const [
    values,
    setValues,
  ] =
    useState<AgencyProfileValues>(
      initial,
    );

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    status,
    setStatus,
  ] =
    useState<{
      ok: boolean;
      message: string;
    } | null>(null);

  function update(
    name: keyof AgencyProfileValues,
    value: string,
  ) {
    setValues(
      (current) => ({
        ...current,
        [name]: value,
      }),
    );

    setStatus(null);
  }

  async function handleSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    setSaving(true);
    setStatus(null);

    try {
      /**
       * Only agency-owned fields are sent.
       *
       * No interview venue.
       * No advertisement contact.
       * No recruitment fields.
       */
      const res =
        await fetch(
          "/api/agencies/profile",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              logoUrl:
                values.logoUrl.trim(),

              contactPerson:
                values.contactPerson.trim(),

              phone:
                values.phone.trim(),

              whatsapp:
                values.whatsapp.trim(),

              officialEmail:
                values.officialEmail.trim(),

              website:
                values.website.trim(),

              officeAddress:
                values.officeAddress.trim(),

              secondaryLogoUrl:
                values.secondaryLogoUrl.trim(),

              brandBadges:
                values.brandBadges
                  .split("\n")
                  .map(
                    (value) =>
                      value.trim(),
                  )
                  .filter(Boolean),
            }),
          },
        );

      if (!res.ok) {
        const body =
          await res
            .json()
            .catch(
              () => null,
            );

        setStatus({
          ok: false,

          message:
            body?.error
              ?.message ??
            "Could not save the agency profile.",
        });

        return;
      }

      setStatus({
        ok: true,

        message:
          "Agency profile saved. Changes remain subject to the applicable KAI verification status.",
      });

      router.refresh();
    } catch {
      setStatus({
        ok: false,

        message:
          "Could not connect to the agency profile service.",
      });
    } finally {
      setSaving(false);
    }
  }

  const agencyApproved =
    agencyStatus ===
    "APPROVED";

  const verificationApproved =
    verificationStatus ===
    "VERIFIED";

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="space-y-6"
    >
      {status && (
        <Alert
          variant={
            status.ok
              ? "default"
              : "destructive"
          }
        >
          <AlertTitle>
            {status.ok
              ? "Profile updated"
              : "Could not save"}
          </AlertTitle>

          <AlertDescription>
            {
              status.message
            }
          </AlertDescription>
        </Alert>
      )}

      {/* ================================================================ */}
      {/* AGENCY IDENTITY                                                   */}
      {/* ================================================================ */}

      <Card>
        <CardHeader>
          <CardTitle>
            Agency Identity
          </CardTitle>

          <CardDescription>
            Permanent identity used across
            your recruitment advertisements.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* LOGO */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">
              Agency Logo
            </label>

            <Input
              value={
                values.logoUrl
              }
              onChange={(
                event,
              ) =>
                update(
                  "logoUrl",
                  event.target
                    .value,
                )
              }
              placeholder="Approved logo URL"
            />

            <p className="text-xs text-muted-foreground">
              The production flow will use
              the approved agency logo here.
              Do not use a campaign-specific
              logo in an advertisement.
            </p>
          </div>

          {/* NAME — DISPLAY ONLY */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">
              Agency Name
            </label>

            <Input
              value={
                agencyName
              }
              readOnly
            />

            <p className="text-xs text-muted-foreground">
              Controlled by the registered
              agency record.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* RC */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">
                RC / MEA Registration No.
              </label>

              <Input
                value={
                  registrationNumber
                }
                readOnly
              />

              <p className="text-xs text-muted-foreground">
                Exact registration identity.
              </p>
            </div>

            {/* MEA */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">
                Registration Authority
              </label>

              <Input
                value="Ministry of External Affairs — Government of India Registered"
                readOnly
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* CREDENTIALS                                                       */}
      {/* ================================================================ */}

      <Card>
        <CardHeader>
          <CardTitle>
            Optional Credentials
          </CardTitle>

          <CardDescription>
            Permanent agency credentials such
            as ISO certification. Only verified
            credentials should appear in published
            advertisements.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Field
            label="ISO / Certification"
            name="brandBadges"
            value={
              values.brandBadges
            }
            onChange={update}
            placeholder="ISO 9001:2015"
            hint="One approved credential per line."
          />

          <Field
            label="ISO / Secondary Logo URL"
            name="secondaryLogoUrl"
            value={
              values.secondaryLogoUrl
            }
            onChange={update}
            placeholder="Approved ISO logo URL"
          />
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* REGISTERED OFFICE                                                 */}
      {/* ================================================================ */}

      <Card>
        <CardHeader>
          <CardTitle>
            Registered Office
          </CardTitle>

          <CardDescription>
            This identifies where the agency is
            officially registered. It is NOT an
            interview venue.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-1.5">
            <label
              className="text-sm font-semibold"
              htmlFor="officeAddress"
            >
              Registered Address
            </label>

            <Textarea
              id="officeAddress"
              value={
                values.officeAddress
              }
              onChange={(event) =>
                update(
                  "officeAddress",
                  event.target
                    .value,
                )
              }
              placeholder="Full registered office address"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* OFFICIAL CONTACT                                                  */}
      {/* ================================================================ */}

      <Card>
        <CardHeader>
          <CardTitle>
            Official Agency Contact
          </CardTitle>

          <CardDescription>
            These are permanent agency details.
            A recruitment advertisement may use
            a different campaign contact.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Contact Person"
              name="contactPerson"
              value={
                values.contactPerson
              }
              onChange={update}
              placeholder="Agency contact person"
            />

            <Field
              label="Official Phone"
              name="phone"
              value={
                values.phone
              }
              onChange={update}
              placeholder="+91..."
            />

            <Field
              label="Official WhatsApp"
              name="whatsapp"
              value={
                values.whatsapp
              }
              onChange={update}
              placeholder="+91..."
            />

            <Field
              label="Official Email"
              name="officialEmail"
              value={
                values.officialEmail
              }
              onChange={update}
              placeholder="jobs@agency.com"
              type="email"
            />

            <Field
              label="Official Website"
              name="website"
              value={
                values.website
              }
              onChange={update}
              placeholder="https://..."
              type="url"
            />
          </div>
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* VERIFICATION                                                      */}
      {/* ================================================================ */}

      <Card>
        <CardHeader>
          <CardTitle>
            Verification
          </CardTitle>

          <CardDescription>
            Agency-submitted information and KAI
            verification are deliberately separate.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Agency Status
              </p>

              <div className="mt-2">
                <Badge
                  variant={
                    agencyApproved
                      ? "success"
                      : "secondary"
                  }
                >
                  {statusLabel(
                    agencyStatus,
                  )}
                </Badge>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                KAI Verification
              </p>

              <div className="mt-2">
                <Badge
                  variant={
                    verificationApproved
                      ? "success"
                      : "secondary"
                  }
                >
                  {statusLabel(
                    verificationStatus,
                  )}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        type="submit"
        disabled={saving}
      >
        {saving
          ? "Saving…"
          : "Save Agency Profile"}
      </Button>
    </form>
  );
}
