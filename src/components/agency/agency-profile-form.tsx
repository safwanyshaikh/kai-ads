"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export interface AgencyProfileValues {
  logoUrl: string;
  contactPerson: string;
  phone: string;
  whatsapp: string;
  officialEmail: string;
  website: string;
  officeAddress: string;
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  name: keyof AgencyProfileValues;
  value: string;
  onChange: (name: keyof AgencyProfileValues, value: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      <Input
        id={name}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(name, e.target.value)}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Agency Profile — filled in once, then used by every advertisement.
 *
 * The recruiter stops retyping their own phone, email and address for each
 * campaign, which is where typos used to reach published artwork.
 */
export function AgencyProfileForm({ initial }: { initial: AgencyProfileValues }) {
  const router = useRouter();
  const [values, setValues] = useState<AgencyProfileValues>(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  function update(name: keyof AgencyProfileValues, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
    setStatus(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/agencies/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setStatus({ ok: false, message: body?.error?.message ?? "Could not save your profile." });
        return;
      }
      setStatus({ ok: true, message: "Saved. New advertisements will use these details." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {status && (
        <Alert variant={status.ok ? "default" : "destructive"}>
          <AlertTitle>{status.ok ? "Profile updated" : "Could not save"}</AlertTitle>
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact person" name="contactPerson" value={values.contactPerson} onChange={update} placeholder="Rahim Khan" />
        <Field label="Phone" name="phone" value={values.phone} onChange={update} placeholder="+91 22 6666 5353" />
        <Field label="WhatsApp" name="whatsapp" value={values.whatsapp} onChange={update} placeholder="+91 98765 43210" />
        <Field label="Email" name="officialEmail" value={values.officialEmail} onChange={update} placeholder="jobs@youragency.com" />
        <Field label="Website" name="website" value={values.website} onChange={update} placeholder="www.youragency.com" />
        <Field label="Logo URL" name="logoUrl" value={values.logoUrl} onChange={update} hint="Used for the footer logo and watermark." />
      </div>

      <Field
        label="Office address"
        name="officeAddress"
        value={values.officeAddress}
        onChange={update}
        placeholder="Andheri East, Mumbai 400059"
      />

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
