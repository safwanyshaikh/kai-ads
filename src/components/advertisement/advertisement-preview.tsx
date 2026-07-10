import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CreateAdvertisementInput } from "@/lib/validations/advertisement";

/**
 * Preview screen — Sprint 002 rule: "No rendering." This is a structured,
 * literal summary of every field, not a rendered advertisement design.
 * Actual visual rendering per style (Visual/Typography/Newspaper) is out
 * of scope until a future sprint.
 */
export function AdvertisementPreview({ data }: { data: CreateAdvertisementInput }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{data.header || "(No header)"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Industry:</span> {data.industry || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Country:</span> {data.country || "—"}
          </p>
          {data.employer && (
            <p>
              <span className="text-muted-foreground">Employer:</span> {data.employer}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Style:</span> <Badge variant="outline">{data.style}</Badge>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Positions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {data.positions.length === 0 && <p className="text-muted-foreground">No positions added.</p>}
          {data.positions.map((position, i) => (
            <p key={i}>
              {position.title}
              {position.count ? ` — ${position.count} openings` : ""}
              {position.experience ? ` · ${position.experience}` : ""}
            </p>
          ))}
        </CardContent>
      </Card>

      {data.benefits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Benefits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {data.benefits.map((benefit, i) => (
              <p key={i}>
                {benefit.label}
                {benefit.detail ? ` — ${benefit.detail}` : ""}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {(data.interview.date || data.interview.location) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Interview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {data.interview.date && <p>Date: {data.interview.date}</p>}
            {data.interview.location && <p>Location: {data.interview.location}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {data.contact.name && <p>{data.contact.name}</p>}
          {data.contact.phone && <p>{data.contact.phone}</p>}
          {data.contact.email && <p>{data.contact.email}</p>}
          {data.contact.whatsapp && <p>WhatsApp: {data.contact.whatsapp}</p>}
          {!data.contact.name && !data.contact.phone && !data.contact.email && !data.contact.whatsapp && (
            <p className="text-muted-foreground">No contact details added.</p>
          )}
        </CardContent>
      </Card>

      {data.footer && (
        <Card>
          <CardContent className="pt-6 text-xs text-muted-foreground">{data.footer}</CardContent>
        </Card>
      )}
    </div>
  );
}
