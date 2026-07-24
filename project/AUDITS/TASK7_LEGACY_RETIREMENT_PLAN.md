# TASK 7 — Legacy Retirement Plan

**Nothing is deleted by this task.** Categorization + the exact deletion
sequence to execute AFTER GPT-Native receives production approval.
Universal precondition for EVERY deletion: the CI quality gate (Task 6 item 1)
must exist first — without it no removal is verifiable at merge time.

## Categories

### SAFE (deletable now, after CI gate + one `git log --follow` confirmation each)
| Item | Evidence |
|---|---|
| `src/components/advertisement/section-editor.tsx` | 0 imports in src/ (grep-verified); superseded by AdvertisementCanvas |
| `src/components/advertisement/style-selector.tsx` | 0 imports; style selection moved to generation panel |
| `src/components/advertisement/advertisement-preview.tsx` | 0 imports; superseded by canvas |
| `AutoPublishPlan` export keyword only (`src/lib/auto-publish.ts:28`) | 0 external references to the name; un-export, keep the type internal |
| `.env.example` stale model lines (`gpt-4.1-mini`) | Doc drift vs `env.ts:111-112` |

### WAITING VALIDATION (unused today; a named question must be answered first)
| Item | Question that gates it |
|---|---|
| 8 UI-unreached API routes (`employees`, advertisements GET-list, versions, history, draft GET, draft style, verifications GET-list, generation-quota GET) | Is an external/mobile client planned? If no → deletable; if yes → keep and document |
| ~13 unused repository methods (list in Task 6 source audits) | Architecture decision: refactor services to USE repositories, or delete the bypassed methods — one decision applied consistently |
| `agencyService.listPending`, `joinRequestService.listForAgency`, `joinRequestRepository.listByAgency` | Confirm paginated variants fully supersede |
| `KAI_IMAGE_SIZE` env var | Confirm no planned resize feature (currently dead: sizes come from platform formats) |
| `join_request:create` permission | **Security decision, not cleanup**: gate public join-request creation with it, or delete it |
| `reassembleFromRequiredInterfaces` fallback (`kai-intelligence-engine.ts:83`) | Verify whether any registered provider lacks `composite` — if none can, the fallback is dead; UNVERIFIED today |

### BLOCKED (must NOT be touched until GPT-Native production approval)
| Item | Unblock condition |
|---|---|
| Legacy pipeline core: `composeAdvertisement`, 4 archetype renderers, `composition-shared.ts`, `acceptance-loop` + Visual QA wiring, `image-export.service.ts` SVG path, bundled fonts | GPT-Native validated in production at approved quality/cost/consistency AND the product owner declares legacy retirement (008 Amendment 1 already scopes the law; the code follows the declaration) |
| Prompt cascade: `buildImageBrief`, `generateGptBackgroundBrief`, `toCreativeBrainDecisions`, `buildCreativeDirectorBrief`, `background-brief/` module | Same — these are stages of the legacy pipeline; retire as one unit |
| Flags `CREATIVE_BRAIN_BACKGROUND_BRIEF`, `CREATIVE_DIRECTOR_BRAIN` | Same; `CREATIVE_DIRECTOR_BRAIN` is only a legacy-path gate (the Brain itself LIVES ON unconditionally inside GPT-Native — the Brain is NOT legacy and is never retired) |
| Legacy-only helpers: `resolveAgencyVisualDna`, `buildAdCopyPlan`, `selectArchetype`, `recommendArchetype`, `styleForArchetype`, `archetypeUsesGeneratedImagery`, `selectBadgeConfig` (badge is composed by legacy renderer; GPT-native records config only) | Same, EXCEPT `resolveAgencyVisualDna` — earmarked for REUSE by the GPT-native DNA fix (Task 3 P5) before legacy retires; migrate, don't delete |
| Legacy-scoped tests (`archetype-composition`, `composition-constitution`, `section-renderer`, `visual-composition`, `acceptance-loop`, `gpt-background-brief-generator`, `creative-brain-adapter`, `creative-director-pipeline-adapter` legacy portions, `qr-composition-pipeline`, `image-export` SVG cases) | Retire with the code they test, same commit |
| `scripts/acceptance/bilfinger-acceptance.ts` + `acceptance-bilfinger.yml` | MIGRATE to GPT-native first (it is the only real-API E2E harness), then retire the legacy version |
| `AI_DAILY_BUDGET_USD`, `aggregateCostByAgency`, `auditLogService.listPaginated`, `auditLogRepository.listForEntity` | Not legacy at all — reserved building blocks for budget enforcement and the audit UI; KEEP |

### KEEP (superficially removal-adjacent; permanently retained)
| Item | Why |
|---|---|
| `GPT_NATIVE_AD_GENERATION` flag | Rollback lever until legacy is GONE; after retirement it may be inverted/removed as a separate, final step |
| Prisma models `Session`/`Account`/`Verification`/`Approval` | Better-Auth-managed / `tx.`-handle-accessed — live |
| `AdvertisementStyle` enum + `style` column | Persisted on every existing row; survives retirement as historical data even if UI stops offering styles |
| Creative Director Brain (all 20 engines) | Constitutionally required (P3); consumed by GPT-Native |
| `sectionRegenerationCount`, `regenerateSection`, section API | Governed by 000 Rule 6 as amended — legacy-scoped feature that retires WITH legacy, but the doctrine decision (canvas-edit + full regenerate) must be implemented first so recruiters never lose the edit capability |

## Exact deletion sequence (post-production-approval)

1. **Gate:** CI quality gate live; GPT-Native approved in writing by product owner.
2. **D1:** SAFE list (5 items) — one commit, full suite green.
3. **D2:** Resolved WAITING-VALIDATION items per their answered questions — one commit per decision group.
4. **D3:** Migrate `resolveAgencyVisualDna` usage into the GPT-native path; migrate the acceptance harness to GPT-native. Verify both live.
5. **D4:** Implement the amended editing doctrine (facts-edit + full GPT regenerate) so section-image-regeneration's removal loses no recruiter capability.
6. **D5:** Delete the legacy pipeline as ONE unit: legacy branch of `advertisement-generation.service.ts` (the dispatcher collapses to GPT-native), archetypes renderers, acceptance loop legacy wiring, background-brief cascade, both legacy flags, legacy-scoped tests. Full suite + typecheck + build green. Tag the pre-deletion commit for rollback.
7. **D6:** Simplify `GPT_NATIVE_AD_GENERATION` (invert or remove) once D5 has soaked in production; update 008 to retire Amendment 1's legacy scoping language (product-owner edit).
8. **D7:** Documentation sweep: README/sprint docs marked historical; 002–006 backfilled describing the POST-retirement architecture.

Total estimated deletion footprint at D5 (from the dead-code inventory): ~15
source modules, 2 flags, ~10 test files, 1 CI workflow replaced — executed only
via this sequence, never piecemeal.
