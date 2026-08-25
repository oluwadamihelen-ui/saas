import { prisma } from "@/server/db/client";
import { randomUUID } from "node:crypto";

/** Creates a throwaway user for a DB-backed test. Cascade-deletes clean up everything on teardown. */
export async function createTestUser(namePrefix = "test") {
  return prisma.user.create({
    data: {
      email: `${namePrefix}-${randomUUID()}@example.test`,
      name: `${namePrefix} user`,
    },
  });
}

export async function deleteTestUser(userId: string) {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}
