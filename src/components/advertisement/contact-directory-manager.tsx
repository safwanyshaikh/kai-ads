"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { upsertContactSchema, type UpsertContactInput } from "@/lib/validations/agency-contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { API_ROUTES } from "@/lib/constants";
import { postJson } from "@/lib/api-client";

export interface AgencyContactRow {
  id: string;
  name: string;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  designation: string | null;
}

/** Contact Directory — "Do not ask the recruiter to type contact information repeatedly." */
export function ContactDirectoryManager({ initialContacts }: { initialContacts: AgencyContactRow[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<UpsertContactInput>({
    resolver: zodResolver(upsertContactSchema),
    defaultValues: { name: "", mobile: "", whatsapp: "", email: "", designation: "" },
  });

  async function onSubmit(values: UpsertContactInput) {
    setError(null);
    const result = await postJson<AgencyContactRow>(API_ROUTES.contacts, values);
    if (!result.ok) {
      setError(result.message ?? "Could not save this contact");
      return;
    }
    setContacts((prev) => [...prev, result.data!]);
    form.reset();
    setShowForm(false);
  }

  async function handleDelete(id: string) {
    const response = await fetch(API_ROUTES.contact(id), { method: "DELETE" });
    if (response.ok) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
    }
  }

  return (
    <div className="space-y-4">
      {contacts.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">No saved contacts yet.</p>
      )}
      {contacts.map((contact) => (
        <div key={contact.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0">
          <div>
            <p className="font-medium">
              {contact.name}
              {contact.designation ? ` · ${contact.designation}` : ""}
            </p>
            <p className="text-muted-foreground">
              {[contact.mobile, contact.whatsapp, contact.email].filter(Boolean).join(" · ") || "No contact details"}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => handleDelete(contact.id)}>
            Remove
          </Button>
        </div>
      ))}

      {showForm ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 rounded-md border p-3">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Could not save contact</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="designation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Designation</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
                Save Contact
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
          Add Contact
        </Button>
      )}
    </div>
  );
}
