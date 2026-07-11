# ADR-006: Advertisement Rendering Architecture

**Status:** Accepted
**Date:** Sprint 004
**Deciders:** KAI Ads Engineering

## Context

Sprint 004 must turn an approved structured recruitment requirement into
a finished advertisement image. Two architectures were on the table:

**Option A — Full-image AI generation.** Ask an image model (e.g. GPT
Image) to render the entire advertisement in one call: background,
layout, and every piece of text (header, positions, salary, phone
numbers, RA license number, QR code) baked into the pixels.

**Option B — AI background/assets + deterministic composition.** Use an
image model only for decorative/background imagery (industry photography,
trade-relevant visuals, thematic texture) and render every piece of
factual text — positions, salary, phone numbers, agency name, RA license
number, the unified verification QR badge — as a separate, deterministic
layer composited on top (SVG/HTML → rasterized), never as image-model
output.

## Decision

**Option B.** AI-generated background/decorative imagery, composited
with deterministically-rendered text and the QR/trust badge.

## Rationale

Every one of the brief's own stated priorities points the same direction:

- **"Never trust image-model-rendered text as the sole source of
  critical recruitment information without validation."** Image models
  are not reliable typesetting engines — they misspell words, invent
  digits in phone numbers, and cannot be constrained to render an exact
  string byte-for-byte. A recruiter's salary figure, RA license number,
  or contact phone number rendered by an image model is a liability, not
  a feature.
- **"Every generated advertisement must pass automated QR decoding
  verification before it can be marked ready. If KAI cannot decode its
  own generated QR: BLOCK READY STATUS."** A QR code is a precise binary
  pattern — finder patterns, quiet zone, error-correction blocks. Asking
  an image model to "draw a QR code" produces something that looks like
  one but very often doesn't scan. A deterministically-rendered QR
  (real QR-encoding library, exact module placement) is the only
  approach that can reliably pass automated decode verification.
- **Section-based editing ("regenerate only the changed section,
  preserve everything else").** A full-image model has no concept of
  "the positions block" as an addressable region — regenerating one
  section either means re-rendering the whole image (contradicting
  "preserve unchanged approved content") or falsely claiming isolated
  regional editing the model can't actually guarantee (which the brief
  explicitly forbids: "Never claim only one visual region was
  regenerated if the provider actually recreated the full image").
  Deterministic composition makes each section a real, independently
  re-renderable layer — the claim and the implementation match.
- **Version control and exact-text guarantees for multi-position, DTP,
  and high-density (20-30 position) layouts.** These need real text
  layout (column flow, font-size scaling by density, precise line
  wrapping) — the kind of control a template/composition engine gives
  you and an end-to-end image model does not.

The tradeoff accepted: Option B produces a more "composed" look and
depends on a composition engine (see Implementation below) rather than a
single model call, and the AI-generated background must be treated as
decoration that composition can crop/mask/tint — not as a source of any
factual content. That tradeoff is the entire point: it's what makes
"exact spelling, exact salary, exact phone numbers, exact RA number,
reliable QR scanning" achievable at all.

## Implementation

- `src/server/generation/section-renderer.ts` — deterministic SVG
  composition of the Typography and Newspaper/DTP styles (pure text/
  layout, no AI image dependency at all — genuinely renderable today).
- `src/server/generation/qr-renderer.ts` — real QR generation
  (`qrcode` npm package) and decode self-verification (`jsqr`) before an
  advertisement can be marked `TRUST_READY`.
- `src/server/ai/image/` — the Visual style's AI-generated background,
  behind the same provider-interface + Null-provider pattern established
  in Sprint 002/003 (`ImageGenerationProvider` interface, `NotImplemented`
  stand-in, real OpenAI GPT Image implementation). The background image
  is one input to composition, never the final output.
- The composition step (background + deterministic text/QR/badge layers
  → final raster asset) is the one piece of Option B that a from-scratch
  build in this sprint implements at the architecture/interface level for
  the Visual style specifically, since it depends on the AI background
  provider being configured; Typography and Newspaper styles need no AI
  image at all and are fully real end-to-end in this sprint.

## Consequences

- Positive: exact text is always exact (it's the same structured data
  already validated by Sprint 002/003, rendered by a template, not
  reinterpreted by a model). QR codes reliably decode because they're
  generated by a real QR library, not approximated by an image model.
  Section editing is real, not a marketing claim. Cost is lower — one
  small background-image call per generation instead of a full
  high-resolution poster render, when AI imagery is used at all.
- Negative: the Visual style's visual sophistication is bounded by the
  composition engine's layout templates, not by whatever an image model
  can freely compose — a real constraint acknowledged, not hidden.
- Follow-up: a full raster compositor (background + SVG overlay →
  flattened PNG/JPEG at each platform's exact pixel dimensions) is scoped
  for continued work; this sprint ships the deterministic
  Typography/Newspaper renderer and QR/badge layer completely, and the
  Visual style's AI-background provider architecture without a live
  OpenAI Images connection (same network-access limitation documented
  since Sprint 001).
