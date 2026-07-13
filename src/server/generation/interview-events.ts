/**
 * Structured multi-city interview support (Decision 3, Sprint 006
 * advertisement-foundation gap-closure).
 *
 * Advertisement.interview is a schemaless Prisma `Json` column — its
 * *shape* can change without any database migration, since Postgres
 * JSON/JSONB columns don't enforce a schema. This lets the single
 * `{ date, location }` shape (every record created before Decision 3)
 * and the new `{ events: [{ date, location }, ...] }` shape coexist in
 * the same column: normalizeInterviewEvents() reads either, so existing
 * advertisements are never silently discarded or require a migration to
 * remain readable.
 */
export interface InterviewEvent {
  date?: string;
  location?: string;
}

interface LegacySingleInterviewShape {
  date?: string;
  location?: string;
}

interface StructuredInterviewShape {
  events: InterviewEvent[];
}

function hasContent(event: InterviewEvent | undefined | null): event is InterviewEvent {
  return Boolean(event && (event.date || event.location));
}

/**
 * The extraction engine's interviewEvents use `venue` (matching the
 * singular interviewVenue field), while this module's canonical name is
 * `location` — found by the real-API acceptance run, where venues
 * silently vanished from every rendered interview box. Reading treats
 * `venue` as an alias so events survive regardless of which producer
 * wrote them.
 */
function toEvent(raw: { date?: string | null; location?: string | null; venue?: string | null }): InterviewEvent {
  return {
    date: raw.date ?? undefined,
    location: raw.location ?? raw.venue ?? undefined,
  };
}

/** Reads the interview JSON column in either its legacy single-event or current multi-event shape. */
export function normalizeInterviewEvents(raw: unknown): InterviewEvent[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Partial<StructuredInterviewShape> & LegacySingleInterviewShape;

  if (Array.isArray(obj.events)) {
    return obj.events.map(toEvent).filter(hasContent);
  }
  const single = toEvent(obj as { date?: string; location?: string; venue?: string });
  if (hasContent(single)) {
    return [single];
  }
  return [];
}

/** Always writes the current structured shape — new/edited advertisements adopt it going forward. */
export function toInterviewJson(events: InterviewEvent[]): StructuredInterviewShape {
  return { events: events.filter(hasContent) };
}
