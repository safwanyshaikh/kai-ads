# TASK 4 — ChatGPT UX Audit

**Benchmark:** ChatGPT's composer. **Subject:** KAI's Create Advertisement flow.
**Evidence files:** `src/components/advertisement/create-advertisement-form.tsx`
(the entire composer), `src/lib/validations/advertisement-draft.ts` +
`prisma/schema.prisma:395-431` (draft data model),
`src/components/advertisement/draft-workspace.tsx` (post-submit flow).
Supreme Constitution Principles 12–13 govern.

## Gap table

| Capability | Current (evidence) | Target (ChatGPT parity) | Gap | Priority |
|---|---|---|---|---|
| Unified composer | Mode picker: text OR one upload type, mutually exclusive (`create-advertisement-form.tsx:81-101`; textarea exists only in PASTE_TEXT branch, line 103) | One surface accepting text and attachments together | Structural | **1** |
| Typing while attachments exist | Impossible — selecting an upload mode removes the textarea | Type before, during, after attaching | Structural | **1** |
| Multiple files | Single file: `e.target.files?.[0]` (line 140), no `multiple` attr | Unlimited mixed attachments | Structural | **1** |
| Multiple PDFs | Not possible (above) | Yes | Structural | **1** |
| Multiple images | Not possible (above) | Yes | Structural | **1** |
| Mixed types (PDF + image + text) | Not possible — draft model stores ONE `sourceType`, ONE `rawText`, ONE `sourceFileUrl` (`schema.prisma:395-431`) | Any combination | **Data-model**, not just UI | **1** |
| Drag & drop | Absent — plain `<Input type="file">` (line 135), no drop handlers in the file | Drop anywhere on the composer | UI | **2** |
| Paste images/screenshots | Text paste only | Paste an image directly into the composer | UI | **2** |
| Attachment previews | None | Thumbnail/name chips | UI | **2** |
| Attachment removal | Impossible — upload immediately creates the draft (line 51), no staged state | Per-chip remove before submit | UI (depends on staged model) | **2** |
| Optional typed instructions with an upload | Not possible (mode exclusivity) | "Here's the JD, make it urgent-toned" alongside files | Structural | **1** |
| Upload progress | Binary "Uploading…" text (line 145) | Per-file progress | UI polish | **3** |
| Conversation flow (follow-up refinement) | None — one-shot: draft → auto-generate → canvas; refinement happens via canvas block edits + regenerate panel | Conversational iteration ("make the headline bigger") | Product decision: the Canvas IS KAI's refinement surface; full chat iteration is a larger bet | **3** (explicit decision needed) |
| Generation flow transparency | Staged status messages ("Analyzing… Composing… Generating…", `draft-workspace.tsx`) | Streaming/progressive feedback | Cosmetic | **3** |
| Error recovery | Honest fallback form pre-filled with whatever was grounded (`draft-workspace.tsx:88-92`) | Inline retry affordances | Mostly compliant already | **3** |
| Zero-friction journey after submit | COMPLIANT: extract → auto-publish → generate → canvas with no forced steps | Same | None | — |

## Summary

The composer fails Principle 12 on 8 of its 10 enumerated requirements. The
binding constraint is the **draft data model** (one source per draft) — no UI
work can deliver multi-attachment behavior until `AdvertisementDraft` can
represent an attachment LIST plus optional instructions text. The schema's
existing JSON-column pattern permits an additive `attachments` JSON field
without destructive migration (design decision for implementation phase, not
made here). Post-submit, the pipeline is already the constitutional ideal;
all P12 debt is concentrated in the input surface.

**Recommended build order (no implementation in this task):**
1. Draft model: multi-attachment + instructions field (additive).
2. Single composer surface: persistent textarea + attachment chips + multi-file input.
3. Drag-drop + paste-image + previews + removal on the staged (pre-draft) state.
4. Progress polish; conversational-refinement product decision separately.
