"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerAgencySchema, type RegisterAgencyInput } from "@/lib/validations/agency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { API_ROUTES, APP_ROUTES } from "@/lib/constants";
import { postJson } from "@/lib/api-client";

async function uploadLogo(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(API_ROUTES.uploadLogo, {
    method: "POST",
    body: formData,
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body?.error?.message ?? "Logo upload failed");
  }
  return body.data.url as string;
}

export function RegisterAgencyForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [secondaryLogoUploading, setSecondaryLogoUploading] = useState(false);

  const form = useForm<RegisterAgencyInput>({
    resolver: zodResolver(registerAgencySchema),
    defaultValues: {
      name: "",
      registrationNumber: "",
      website: "",
      officialEmail: "",
      logoUrl: "",
      secondaryLogoUrl: "",
    },
  });

  async function handleLogoChange(
    event: React.ChangeEvent<HTMLInputElement>,
    field: "logoUrl" | "secondaryLogoUrl",
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    const setUploading = field === "logoUrl" ? setLogoUploading : setSecondaryLogoUploading;
    setUploading(true);
    setSubmitError(null);
    try {
      const url = await uploadLogo(file);
      form.setValue(field, url, { shouldValidate: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Logo upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(values: RegisterAgencyInput) {
    setSubmitError(null);
    const result = await postJson(API_ROUTES.agencies, values);

    if (!result.ok) {
      setSubmitError(result.message ?? "Registration failed");
      return;
    }

    router.push(APP_ROUTES.pendingApproval);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {submitError && (
          <Alert variant="destructive">
            <AlertTitle>Could not register agency</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Agency Name</FormLabel>
              <FormControl>
                <Input placeholder="Al Noor Overseas Recruitment" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="registrationNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Registration Number</FormLabel>
              <FormControl>
                <Input placeholder="e.g. RA/1234/2024" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Website</FormLabel>
              <FormControl>
                <Input placeholder="https://youragency.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="officialEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Official Business Email</FormLabel>
              <FormControl>
                <Input placeholder="admin@youragency.com" {...field} />
              </FormControl>
              <FormDescription>
                Personal email addresses (Gmail, Yahoo, etc.) are not accepted.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="logoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Agency Logo</FormLabel>
              <FormControl>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => handleLogoChange(e, "logoUrl")}
                  disabled={logoUploading}
                />
              </FormControl>
              {logoUploading && <FormDescription>Uploading…</FormDescription>}
              {field.value && !logoUploading && (
                <FormDescription>Logo uploaded.</FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="secondaryLogoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Secondary Logo (Optional)</FormLabel>
              <FormControl>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => handleLogoChange(e, "secondaryLogoUrl")}
                  disabled={secondaryLogoUploading}
                />
              </FormControl>
              {secondaryLogoUploading && <FormDescription>Uploading…</FormDescription>}
              {field.value && !secondaryLogoUploading && (
                <FormDescription>Secondary logo uploaded.</FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting || logoUploading || secondaryLogoUploading}
        >
          {form.formState.isSubmitting ? "Submitting…" : "Submit Registration"}
        </Button>
      </form>
    </Form>
  );
}
