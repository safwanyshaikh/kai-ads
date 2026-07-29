import { NextResponse, type NextRequest } from "next/server";
import { updateAgencyProfileSchema } from "@/lib/validations/agency";
import { agencyService } from "@/server/services/agency.service";
import { handleApiError, AppError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { assertPermission } from "@/lib/rbac";

/**
 * PATCH /api/agencies/profile — the agency edits its own profile.
 *
 * Always scoped to the caller's own agencyId, never an id from the body:
 * that is what stops one tenant editing another's branding. Name, MEA
 * licence, verification status and QR destination are not accepted here at
 * all — they are admin-controlled, and they are what make the verification
 * QR worth trusting.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    assertPermission(user, "agency:manage_own");

    if (!user.agencyId) {
      throw new AppError("You are not a member of an agency.", 403, "NO_AGENCY");
    }

    const input = updateAgencyProfileSchema.parse(await request.json());
    const agency = await agencyService.updateProfile(user.agencyId, user.id, input);

    return NextResponse.json({
      data: {
        id: agency.id,
        logoUrl: agency.logoUrl,
        contactPerson: agency.contactPerson,
        phone: agency.phone,
        whatsapp: agency.whatsapp,
        officialEmail: agency.officialEmail,
        website: agency.website,
        officeAddress: agency.officeAddress,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
