import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { APP_ROUTES } from "@/lib/constants";

const STATUS_OPTIONS = ["DRAFT", "REVIEW", "APPROVED", "ARCHIVED"] as const;

export function AdvertisementSearchBar({
  q,
  status,
  industry,
  country,
}: {
  q?: string;
  status?: string;
  industry?: string;
  country?: string;
}) {
  return (
    <form
      method="get"
      action={APP_ROUTES.advertisements}
      className="flex flex-wrap items-end gap-3 rounded-md border p-4"
    >
      <div className="flex-1 min-w-[200px] space-y-1">
        <label className="text-xs text-muted-foreground" htmlFor="q">
          Search
        </label>
        <Input id="q" name="q" placeholder="Header, employer, industry, country" defaultValue={q} />
      </div>
      <div className="w-40 space-y-1">
        <label className="text-xs text-muted-foreground" htmlFor="industry">
          Industry
        </label>
        <Input id="industry" name="industry" defaultValue={industry} />
      </div>
      <div className="w-40 space-y-1">
        <label className="text-xs text-muted-foreground" htmlFor="country">
          Country
        </label>
        <Input id="country" name="country" defaultValue={country} />
      </div>
      <div className="w-44 space-y-1">
        <label className="text-xs text-muted-foreground" htmlFor="status">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={status ?? ""}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
        >
          <option value="">All</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit">Filter</Button>
      {(q || status || industry || country) && (
        <Button type="button" variant="ghost" asChild>
          <a href={APP_ROUTES.advertisements}>Clear</a>
        </Button>
      )}
    </form>
  );
}
