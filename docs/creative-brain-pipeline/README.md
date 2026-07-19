# Creative Brain Pipeline — Project Memory

This folder is the copy-paste memory of the Creative-Brain-driven background
pipeline work. It captures, in order, every approved deliverable so the
decisions survive outside any single chat session.

Target pipeline:

```
Source → Truth Brain → Creative Brain → GPT Background Brief Generator
       → GPT Image → Frozen Overlay → Final Ad
```

## Contents

| File | What it is | Status |
|---|---|---|
| `01-creative-brain-specification.md` | The Creative Brain decision engine (18 outputs) + worked Bilfinger example | Approved / locked |
| `02-gpt-background-brief.md` | The manually approved GPT background brief for Bilfinger | Approved |
| `03-cd-verdict-v12.md` | Creative Director verdict on the V12 masterpiece (why it was NOT publish-ready) | Reference |
| `04-integration-plan.md` | Reversible integration plan (dependency map, phases, risk, rollback) | Approved |
| `05-phase-a-report.md` | Phase A implementation report (flag + adapter + full parity + tests) | Complete / dormant |
| `06-positioning-and-tenancy.md` | KAI vs tenant (agency) vs client (employer); the benchmark is KAI's own frame, not the market papers | Locked note |
| `07-assignments-abroad-dtp-framework.md` | **The DTP ad grammar learned from Assignments Abroad Times — white newsprint, real logos, no dark theme. Refer for EVERY DTP ad.** | Canonical reference |
| `08-creative-director-module.md` | **Creative Director Module v1.0 — the 15-engine brain (priority, country, currency, industry, psychology, story, personality, benefits, interview, positions, trust, typography, mobile, validation, score) + Country Intelligence table.** | LOCKED |
| `09-multi-vacancy-poster-layout.md` | **Locked premium poster layout for multi-vacancy files (grouped division cards, hero photo, apply highlight, trust footer).** | LOCKED |

## Standing constraints (across all files)

- The renderer, overlay engine, trust footer, QR system, source-fidelity
  system, GPT background pipeline, and `buildImageBrief()` are **frozen**.
- Truth Brain: every advertisement fact must be source-grounded; the
  Creative Brain may only reorder / emphasize / reframe — never invent.
- Verification QR always encodes the KAI-controlled `/v/` route.
- Agency Visual DNA is part of the product moat: the Creative Brain decides
  direction, Agency DNA applies identity — DNA is never replaced by mood.
- Phase A feature flag `CREATIVE_BRAIN_BACKGROUND_BRIEF` defaults **OFF**;
  production is byte-for-byte identical until it is explicitly enabled.
