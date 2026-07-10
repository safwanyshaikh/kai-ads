"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createJoinRequestSchema, type CreateJoinRequestInput } from "@/lib/validations/join-request";
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
import { API_ROUTES } from "@/lib/constants";
import { postJson } from "@/lib/api-client";

export function JoinRequestForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ agencyName: string } | null>(null);

  const form = useForm<CreateJoinRequestInput>({
    resolver: zodResolver(createJoinRequestSchema),
    defaultValues: { email: "", name: "" },
  });

  async function onSubmit(values: CreateJoinRequestInput) {
    setError(null);
    const result = await postJson<{ agencyName: string }>(API_ROUTES.joinRequests, values);

    if (!result.ok) {
      setError(result.message ?? "Could not submit join request");
      return;
    }

    setSuccess({ agencyName: result.data!.agencyName });
  }

  if (success) {
    return (
      <Alert>
        <AlertTitle>Request sent</AlertTitle>
        <AlertDescription>
          We detected <strong>{success.agencyName}</strong> from your email
          domain. Your request is waiting for approval from your agency
          admin.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not submit request</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="Your full name" {...field} />
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
              <FormLabel>Business Email</FormLabel>
              <FormControl>
                <Input placeholder="you@youragency.com" {...field} />
              </FormControl>
              <FormDescription>
                We detect your agency from your email domain automatically.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Submitting…" : "Request to Join"}
        </Button>
      </form>
    </Form>
  );
}
