import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";

// Tears down a school created by create-prospect-preview.ts. Every
// schoolId foreign key in prisma/schema.prisma cascades on delete, so
// deleting the School row is enough to remove everything under it — that
// also makes this genuinely irreversible, hence the required --confirm
// and the paid-invoice safety check below.
//
// Run with:
//   npx tsx --tsconfig tsconfig.json prisma/scripts/delete-prospect-preview.ts --slug=steadyflow
//   npx tsx --tsconfig tsconfig.json prisma/scripts/delete-prospect-preview.ts --slug=steadyflow --confirm

const prisma = new PrismaClient();

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

async function main() {
  const slug = arg("slug");
  const confirmed = process.argv.includes("--confirm");

  if (!slug) {
    console.error("Missing --slug=<school-slug>");
    process.exit(1);
  }

  const school = await prisma.school.findUnique({
    where: { slug },
    include: {
      _count: { select: { students: true, users: true } },
    },
  });
  if (!school) {
    console.error(`No school with slug "${slug}" exists — nothing to delete.`);
    process.exit(1);
  }

  // If this school has ever actually paid Schoolum, it's a real customer,
  // not a throwaway prospect preview — refuse regardless of --confirm.
  // (A prospect preview is only ever created with status ACTIVE and never
  // has a PlatformInvoice at all, since it never goes through billing.)
  const paidInvoiceCount = await prisma.platformInvoice.count({ where: { schoolId: school.id, status: "PAID" } });
  if (paidInvoiceCount > 0) {
    console.error(
      `Refusing to delete "${school.name}" (slug: ${slug}) — it has ${paidInvoiceCount} PAID invoice(s), which means it's a real ` +
        `paying customer, not a prospect preview. If you're sure this is meant to be deleted, do it from Super Admin instead.`
    );
    process.exit(1);
  }

  console.log(`School:   ${school.name} (slug: ${slug})`);
  console.log(`Created:  ${school.createdAt.toISOString().slice(0, 10)}`);
  console.log(`Students: ${school._count.students}`);
  console.log(`Users:    ${school._count.users}`);

  if (!confirmed) {
    console.log(`\nThis is a dry run — nothing was deleted. Re-run with --confirm to actually delete "${slug}" and everything in it.`);
    return;
  }

  await prisma.school.delete({ where: { id: school.id } });
  console.log(`\nDeleted "${school.name}" (slug: ${slug}) and everything under it.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
