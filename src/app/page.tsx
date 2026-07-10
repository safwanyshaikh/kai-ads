import Link from "next/link";
import { Button } from "@/components/ui/button";
import { APP_ROUTES } from "@/lib/constants";

/**
 * Screen 1 — Landing Page (Functional Spec).
 * Actions: Login, Register Agency, Learn More, Pricing.
 * Pure presentation — no business logic, no data fetching.
 */
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold tracking-tight">KAI Ads</span>
          <nav className="flex items-center gap-3">
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
            <Link href="#learn-more" className="text-sm text-muted-foreground hover:text-foreground">
              Learn More
            </Link>
            <Button asChild variant="ghost" size="sm">
              <Link href={APP_ROUTES.login}>Login</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={APP_ROUTES.register}>Register Agency</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Built for licensed overseas recruitment agencies
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Create a professional recruitment advertisement in under 60 seconds
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Less typing. More selecting. Maximum automation. KAI Ads combines
          artificial intelligence with recruitment expertise so your team
          spends time recruiting — not designing advertisements.
        </p>
        <div className="mt-10 flex gap-4">
          <Button asChild size="lg">
            <Link href={APP_ROUTES.register}>Register Your Agency</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={APP_ROUTES.login}>Login</Link>
          </Button>
        </div>
      </main>

      <section id="learn-more" className="border-t bg-muted/30 px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-3">
          <div>
            <h3 className="font-semibold">AI Assists, You Approve</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Every advertisement stays editable, block by block. AI never
              invents salary, employer, or interview details.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Built For Recruiters</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              No design skills required. Paste text, upload a PDF, or forward
              a WhatsApp message — KAI extracts what matters.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Compliance First</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Every agency is verified before activation, and every
              advertisement can carry your MEA registration and trust stamp.
            </p>
          </div>
        </div>
      </section>

      <section id="pricing" className="px-6 py-16 text-center">
        <h2 className="text-2xl font-semibold">Pricing</h2>
        <p className="mt-3 text-muted-foreground">
          Credit-based plans for licensed agencies. Contact us after
          registration to activate your subscription.
        </p>
      </section>

      <footer className="border-t px-6 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} KAI Ads. Part of the KAI Platform.
      </footer>
    </div>
  );
}
