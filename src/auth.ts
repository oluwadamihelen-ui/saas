import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth/config";
import { checkPasswordWithLockout } from "@/lib/auth/login-lockout";

function toSessionUser(user: { id: string; email: string; name: string; schoolId: string | null; role: { key: string } }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role.key, schoolId: user.schoolId };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // A student too young to have their own email logs in with their
        // school + admission number instead of email — see the "Student
        // login" tab on the login page. Both fields are optional at the
        // NextAuth level; whichever pair is actually filled in decides
        // which branch below runs.
        schoolSlug: { label: "School", type: "text" },
        admissionNumber: { label: "Admission Number", type: "text" },
      },
      authorize: async (credentials) => {
        const password = String(credentials?.password ?? "");
        if (!password) return null;

        const admissionNumber = String(credentials?.admissionNumber ?? "").trim();
        const schoolSlug = String(credentials?.schoolSlug ?? "").trim().toLowerCase();

        if (admissionNumber && schoolSlug) {
          const school = await prisma.school.findUnique({ where: { slug: schoolSlug } });
          if (!school) return null;

          const student = await prisma.student.findFirst({
            where: { schoolId: school.id, admissionNumber, status: "ACTIVE", userId: { not: null } },
            include: { user: { include: { role: true } } },
          });
          if (!student?.user || student.user.status !== "ACTIVE") return null;

          const valid = await checkPasswordWithLockout(student.user, password);
          if (!valid) return null;

          return toSessionUser(student.user);
        }

        const email = String(credentials?.email ?? "").toLowerCase().trim();
        if (!email) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { role: true },
        });
        if (!user || user.status !== "ACTIVE") return null;

        const valid = await checkPasswordWithLockout(user, password);
        if (!valid) return null;

        return toSessionUser(user);
      },
    }),
  ],
});
