import { createAgencyLifecycleRoute } from "@/server/http/agency-lifecycle-route";
import { activateAgencySchema } from "@/lib/validations/agency";
import { agencyService } from "@/server/services/agency.service";

/** POST /api/agencies/[id]/activate — KAI Super Admin only. */
export const POST = createAgencyLifecycleRoute({
  permission: "agency:activate",
  schema: activateAgencySchema,
  action: agencyService.activate,
});
