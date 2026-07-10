import { createAgencyLifecycleRoute } from "@/server/http/agency-lifecycle-route";
import { suspendAgencySchema } from "@/lib/validations/agency";
import { agencyService } from "@/server/services/agency.service";

/** POST /api/agencies/[id]/suspend — KAI Super Admin only. */
export const POST = createAgencyLifecycleRoute({
  permission: "agency:suspend",
  schema: suspendAgencySchema,
  action: agencyService.suspend,
});
