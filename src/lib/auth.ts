import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "OWNER" | "VIEWER";
    } & DefaultSession["user"];
  }
  interface User {
    role?: "OWNER" | "VIEWER";
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// NOTE: We intentionally do NOT pass a `PrismaAdapter` here.
// Auth.js v5 + Credentials provider + `strategy: "jwt"` must not use a
// database adapter — the adapter expects an OAuth-style Account row which
// Credentials never creates, and its presence makes sign-in silently fail
// with `CallbackRouteError`. We look the user up manually in `authorize()`
// and store everything we need on the JWT.
export const { auth, handlers, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/?signin=1" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        // Only OWNER accounts may sign in. Anyone else can still READ the
        // public site without an account at all.
        if (user.role !== "OWNER") return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: (user.role as "OWNER" | "VIEWER") ?? "VIEWER",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: "OWNER" | "VIEWER" }).role ?? "VIEWER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? "";
        session.user.role = (token.role as "OWNER" | "VIEWER") ?? "VIEWER";
      }
      return session;
    },
  },
});