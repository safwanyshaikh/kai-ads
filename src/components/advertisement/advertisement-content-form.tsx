"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAdvertisementSchema, type CreateAdvertisementInput } from "@/lib/validations/advertisement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_ROUTES } from "@/lib/constants";

interface SavedContact {
  id: string;
  name: string;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  designation: string | null;
}

export const EMPTY_ADVERTISEMENT_CONTENT: CreateAdvertisementInput = {
  header: "",
  industry: "",
  country: "",
  employer: "",
  positions: [{ title: "" }],
  benefits: [],
  interview: {},
  contact: {},
  footer: "",
  style: "VISUAL",
};

/**
 * Every block below is its own FormField group — editing one never
 * touches another's data (Product Constitution "Golden Rule" for
 * editing), enforced here by React Hook Form's per-field isolation and
 * at the API boundary by the same Zod schema per block.
 */
export function AdvertisementContentForm({
  defaultValues,
  onSubmit,
  submitLabel = "Continue",
  submitting = false,
}: {
  defaultValues?: Partial<CreateAdvertisementInput>;
  onSubmit: (values: CreateAdvertisementInput) => void | Promise<void>;
  submitLabel?: string;
  submitting?: boolean;
}) {
  const form = useForm({
    resolver: zodResolver(createAdvertisementSchema),
    defaultValues: { ...EMPTY_ADVERTISEMENT_CONTENT, ...defaultValues },
  });

  const positions = useFieldArray({ control: form.control, name: "positions" });
  const benefits = useFieldArray({ control: form.control, name: "benefits" });

  const [savedContacts, setSavedContacts] = useState<SavedContact[]>([]);

  useEffect(() => {
    fetch(API_ROUTES.contacts)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body?.data) setSavedContacts(body.data);
      })
      .catch(() => undefined);
  }, []);

  function applySavedContact(contactId: string) {
    const contact = savedContacts.find((c) => c.id === contactId);
    if (!contact) return;
    form.setValue("contact.name", contact.name, { shouldDirty: true });
    form.setValue("contact.phone", contact.mobile ?? "", { shouldDirty: true });
    form.setValue("contact.email", contact.email ?? "", { shouldDirty: true });
    form.setValue("contact.whatsapp", contact.whatsapp ?? "", { shouldDirty: true });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Header</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="header"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Advertisement Header</FormLabel>
                  <FormControl>
                    <Input placeholder="Welders Needed — Gulf" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input placeholder="Construction" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input placeholder="UAE" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="employer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employer (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Construction LLC" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Positions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {positions.fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_100px_auto]">
                <FormField
                  control={form.control}
                  name={`positions.${index}.title`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Welder" {...f} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`positions.${index}.count`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Count</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...f} value={f.value ? String(f.value) : ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={positions.fields.length <= 1}
                    onClick={() => positions.remove(index)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => positions.append({ title: "" })}>
              Add Position
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Benefits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {benefits.fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]">
                <FormField
                  control={form.control}
                  name={`benefits.${index}.label`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Benefit</FormLabel>
                      <FormControl>
                        <Input placeholder="Free accommodation" {...f} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`benefits.${index}.detail`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Detail (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Shared, air-conditioned" {...f} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => benefits.remove(index)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => benefits.append({ label: "" })}
            >
              Add Benefit
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Interview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="interview.date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input placeholder="1 Aug 2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="interview.location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Agency Office, Mumbai" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {savedContacts.length > 0 && (
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Use a saved contact</label>
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                  defaultValue=""
                  onChange={(e) => e.target.value && applySavedContact(e.target.value)}
                >
                  <option value="">Choose from directory…</option>
                  {savedContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.designation ? ` (${c.designation})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <FormField
              control={form.control}
              name="contact.name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Agency Desk" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact.phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+91 90000 00000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact.email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="jobs@youragency.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact.whatsapp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp</FormLabel>
                  <FormControl>
                    <Input placeholder="+91 90000 00000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Footer</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="footer"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Registration No. / trust stamp text"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={submitting || form.formState.isSubmitting}>
          {submitting || form.formState.isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </form>
    </Form>
  );
}
