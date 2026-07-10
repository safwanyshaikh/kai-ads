"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { magicLinkRequestSchema, type MagicLinkRequestInput } from "@/lib/validations/auth";
import { authClient } from "@/lib/auth-client";
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
import { APP_ROUTES } from "@/lib/constants";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "microsoft" | null>(null);

  const form = useForm<MagicLinkRequestInput>({
    resolver: zodResolver(magicLinkRequestSchema),
    defaultValues: { email: "" },
  });

  async function handleSocial(provider: "google" | "microsoft") {
    setError(null);
    setSocialLoading(provider);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: APP_ROUTES.dashboard,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setSocialLoading(null);
    }
  }

  async function onSubmit(values: MagicLinkRequestInput) {
    setError(null);
    const { error: signInError } = await authClient.signIn.magicLink({
      email: values.email,
      callbackURL: APP_ROUTES.dashboard,
    });

    if (signInError) {
      setError(signInError.message ?? "Could not send sign-in link");
      return;
    }
    setLinkSent(true);
  }

  if (linkSent) {
    return (
      <Alert>
        <AlertTitle>Check your inbox</AlertTitle>
        <AlertDescription>
          We sent a sign-in link to {form.getValues("email")}. It expires in
          15 minutes.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Sign-in failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={socialLoading !== null}
          onClick={() => handleSocial("google")}
        >
          {socialLoading === "google" ? "Redirecting…" : "Continue with Google Workspace"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={socialLoading !== null}
          onClick={() => handleSocial("microsoft")}
        >
          {socialLoading === "microsoft" ? "Redirecting…" : "Continue with Microsoft 365"}
        </Button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Email</FormLabel>
                <FormControl>
                  <Input placeholder="you@youragency.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Sending…" : "Send Magic Link"}
          </Button>
        </form>
      </Form>

      <p className="text-center text-xs text-muted-foreground">
        No passwords. We never ask you to type a password on KAI Ads.
      </p>
    </div>
  );
}
