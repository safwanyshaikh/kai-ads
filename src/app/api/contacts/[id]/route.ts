import { NextResponse, type NextRequest } from "next/server";
import { upsertContactSchema } from "@/lib/validations/agency-contact";
import { agencyContactService } from "@/server/services/agency-contact.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";

/** PATCH /api/contacts/[id] */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:create");
    const { id } = await params;
    const body = await request.json();
    const input = upsertContactSchema.parse(body);
    const contact = await agencyContactService.update(id, user.agencyId, user.id, input);
    return NextResponse.json({ data: contact });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/contacts/[id] — soft delete. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:create");
    const { id } = await params;
    await agencyContactService.remove(id, user.agencyId, user.id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return handleApiError(error);
  }
}
