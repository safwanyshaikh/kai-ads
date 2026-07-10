import { NextResponse, type NextRequest } from "next/server";
import { upsertContactSchema } from "@/lib/validations/agency-contact";
import { agencyContactService } from "@/server/services/agency-contact.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";

/** POST /api/contacts — add a contact to the agency's directory. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAgencyMember("advertisement:create");
    const body = await request.json();
    const input = upsertContactSchema.parse(body);
    const contact = await agencyContactService.create(user.agencyId, user.id, input);
    return NextResponse.json({ data: contact }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/** GET /api/contacts — the caller's own agency directory only. */
export async function GET() {
  try {
    const user = await requireAgencyMember("advertisement:view");
    const contacts = await agencyContactService.list(user.agencyId);
    return NextResponse.json({ data: contacts });
  } catch (error) {
    return handleApiError(error);
  }
}
