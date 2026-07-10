import { createAgencyLifecycleRoute } from "@/server/http/agency-lifecycle-route";
import { rejectAgencySchema } from "@/lib/validations/agency";
import { agencyService } from "@/server/services/agency.service";

/** POST /api/agencies/[id]/reject — KAI Super Admin only. */
export const POST = createAgencyLifecycleRoute({
  permission: "agency:reject",
  schema: rejectAgencySchema,
  action: agencyService.reject,
});
