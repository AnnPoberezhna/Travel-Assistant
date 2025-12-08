import { NextRequest, NextResponse } from "next/server";
import { resolveCurrentUser } from "../users/route";

export async function GET(req: NextRequest) {
  const current = await resolveCurrentUser(req);
  if (!current) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  return NextResponse.json({ authenticated: true, userId: current.id, role: current.role });
}
