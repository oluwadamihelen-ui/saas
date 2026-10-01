import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/** Usage: npm run make-admin -- someone@example.com */
const prisma = new PrismaClient();
const email = process.argv[2]?.toLowerCase().trim();

async function main() {
  if (!email) throw new Error("Usage: npm run make-admin -- <email>");
  const u = await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
  console.log(`${u.email} is now an admin.`);
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
