import { buildRecruitmentCampaign } from "../src/server/generation/pipeline/content-intelligence";
import { decideSocialProduct, assertSlidePlanIntegrity } from "../src/server/generation/pipeline/social-product-decision";
import { MANPOWER_VACANT_POSITION_2 } from "../tests/fixtures/manpower-vacant-position-2";

async function main() {
  const campaign = buildRecruitmentCampaign(MANPOWER_VACANT_POSITION_2);
  const d = decideSocialProduct(campaign, 1080);
  console.log("PRODUCT:", d.product);
  console.log("REASON :", d.reason);
  console.log("MASS   :", JSON.stringify(d.mass, null, 2));
  if (d.slides) {
    assertSlidePlanIntegrity(campaign, d.slides);
    console.log("SLIDES :");
    for (const s of d.slides) {
      console.log(`  ${s.index}. [${s.kind}] ${s.title} — ${s.positionIndexes.length} roles`);
    }
    const total = d.slides.reduce((n, s) => n + s.positionIndexes.length, 0);
    console.log(`INTEGRITY: ${total}/${campaign.positions.length} positions placed, no duplicates, no drops`);
    const vac = d.slides.flatMap(s => s.positionIndexes).reduce((n,i)=>n+(campaign.positions[i].count ?? 0),0);
    console.log(`VACANCIES ACROSS CAROUSEL: ${vac} (source total ${campaign.vacancySummary.totalVacancies})`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
