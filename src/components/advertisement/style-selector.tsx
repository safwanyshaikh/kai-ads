"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const STYLES = [
  {
    value: "VISUAL" as const,
    title: "Visual",
    description: "Image-forward layout with strong color blocks.",
  },
  {
    value: "TYPOGRAPHY" as const,
    title: "Typography",
    description: "Clean, text-led layout — no imagery required.",
  },
  {
    value: "NEWSPAPER" as const,
    title: "Newspaper",
    description: "Classic classified-ad column layout.",
  },
];

/**
 * Style Selection — Sprint 002: "Store only. No rendering." This picks
 * and persists a style value; actual visual rendering of each style is a
 * future sprint's concern.
 */
export function StyleSelector({
  value,
  onChange,
}: {
  value: "VISUAL" | "TYPOGRAPHY" | "NEWSPAPER" | null | undefined;
  onChange: (style: "VISUAL" | "TYPOGRAPHY" | "NEWSPAPER") => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {STYLES.map((style) => (
        <Card
          key={style.value}
          role="radio"
          aria-checked={value === style.value}
          tabIndex={0}
          onClick={() => onChange(style.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onChange(style.value);
            }
          }}
          className={cn(
            "cursor-pointer transition-colors hover:border-primary",
            value === style.value && "border-primary ring-2 ring-primary/30",
          )}
        >
          <CardHeader>
            <CardTitle className="text-base">{style.title}</CardTitle>
            <CardDescription>{style.description}</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {value === style.value ? "Selected" : "Tap to select"}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
