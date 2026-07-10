import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Bootstraps the first KAI Super Admin.
 *
 * There is no UI path to create a Super Admin (by design — it's the root
 * of the approval chain), so it must be seeded. Reads from env so no
 * credentials are hardcoded in source control.
 *
 * Usage:
 *   SEED_SUPER_ADMIN_EMAIL=you@kai.dev SEED_SUPER_ADMIN_NAME="Your Name" npx prisma db seed
 */
async function main() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const name = process.env.SEED_SUPER_ADMIN_NAME ?? "KAI Super Admin";

  if (!email) {
    console.log(
      "SEED_SUPER_ADMIN_EMAIL not set — skipping Super Admin bootstrap.\n" +
        "Set it and re-run `npx prisma db seed` to create the first admin.",
    );
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "KAI_SUPER_ADMIN" || existing.status !== "ACTIVE") {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "KAI_SUPER_ADMIN", status: "ACTIVE" },
      });
      console.log(`Promoted existing user ${email} to KAI_SUPER_ADMIN.`);
    } else {
      console.log(`${email} is already an active KAI Super Admin.`);
    }
    return;
  }

  await prisma.user.create({
    data: {
      email,
      name,
      role: "KAI_SUPER_ADMIN",
      status: "ACTIVE",
      emailVerified: true,
    },
  });

  console.log(`Created KAI Super Admin: ${email}`);
  console.log(
    "Sign in with Google Workspace, Microsoft 365, or a Magic Link using this exact email.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
