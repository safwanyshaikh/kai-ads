import { createAgencyLifecycleRoute } from "@/server/http/agency-lifecycle-route";
import { approveAgencySchema } from "@/lib/validations/agency";
import { agencyService } from "@/server/services/agency.service";

/** POST /api/agencies/[id]/approve — KAI Super Admin only. */
export const POST = createAgencyLifecycleRoute({
  permission: "agency:approve",
  schema: approveAgencySchema,
  action: agencyService.approve,
});
