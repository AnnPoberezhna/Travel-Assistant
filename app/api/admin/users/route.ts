import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getToken } from "next-auth/jwt";

export async function resolveCurrentUser(req: NextRequest): Promise<{ id: number; role: string } | null> {
  try {
    const token: any = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    let user: any = null;

    // Primary: by user ID from token
    const sid = token?.sub ?? token?.id;
    if (sid !== undefined && !Number.isNaN(Number(sid))) {
      user = await prisma.user.findUnique({ where: { id: Number(sid) } });
    }

    // Fallback: by email (case-insensitive)
    if (!user && token?.email) {
      user = await prisma.user.findFirst({ where: { email: { equals: String(token.email), mode: "insensitive" } } });
    }

    // Fallback: by username/name (case-insensitive)
    const uname = token?.username ?? token?.name;
    if (!user && uname) {
      user = await prisma.user.findFirst({ where: { username: { equals: String(uname), mode: "insensitive" } } });
    }

    // Ultimate fallback: call session endpoint if token is missing
    if (!user) {
      const url = new URL(req.url);
      const sessionRes = await fetch(`${url.origin}/api/auth/session`, {
        headers: { cookie: req.headers.get("cookie") ?? "" },
        cache: "no-store",
      });
      if (sessionRes.ok) {
        const session: any = await sessionRes.json().catch(() => null);
        const sid2 = session?.user?.id;
        if (sid2 !== undefined && !Number.isNaN(Number(sid2))) {
          user = await prisma.user.findUnique({ where: { id: Number(sid2) } });
        }
        if (!user && session?.user?.email) {
          user = await prisma.user.findFirst({ where: { email: { equals: String(session.user.email), mode: "insensitive" } } });
        }
        const sname = (session?.user as any)?.name;
        if (!user && sname) {
          user = await prisma.user.findFirst({ where: { username: { equals: String(sname), mode: "insensitive" } } });
        }
      }
    }
    if (!user) return null;
    return { id: Number(user.id), role: String(user.role) };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const current = await resolveCurrentUser(req);
  if (!current || current.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const all = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });
  const users = all.map((u: any) => ({
    id: u.id,
    email: u.email,
    username: u.username,
    role: String(u.role ?? "USER"),
    createdAt: u.createdAt,
  }));
  return NextResponse.json({ users });
}

export async function DELETE(req: NextRequest) {
  const current = await resolveCurrentUser(req);
  if (!current || current.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const idStr = url.searchParams.get("id");
  const id = idStr ? Number(idStr) : NaN;
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Missing 'id'" }, { status: 400 });
  }
  if (id === current.id) {
    return NextResponse.json({ error: "Cannot delete own admin account" }, { status: 400 });
  }
  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
