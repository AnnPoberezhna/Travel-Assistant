import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";

// GET - favourite routes of user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email! },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const favoriteRoutes = await db.favoriteRoutes.findMany({
      where: {
        uzytkownikId: user.id,
      },
      include: {
        przystanekStart: true,
        przystanekKoniec: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(favoriteRoutes);
  } catch (error) {
    console.error("Error fetching favorite routes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST -  add new fav route
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email! },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const { przystanekStartId, przystanekKoniecId } = await req.json();

    if (!przystanekStartId || !przystanekKoniecId) {
      return NextResponse.json(
        { error: "Missing required fields: przystanekStartId and przystanekKoniecId" },
        { status: 400 }
      );
    }

    if (przystanekStartId === przystanekKoniecId) {
      return NextResponse.json(
        { error: "Start and end stops cannot be the same" },
        { status: 400 }
      );
    }

    // Check if przystanek existed
    const [startStop, endStop] = await Promise.all([
      db.przystanek.findUnique({ where: { id: przystanekStartId } }),
      db.przystanek.findUnique({ where: { id: przystanekKoniecId } }),
    ]);

    if (!startStop || !endStop) {
      return NextResponse.json(
        { error: "One or both stops not found" },
        { status: 404 }
      );
    }

    // Add your favorite route (upsert - if it exists, return the existing one)
    const favoriteRoute = await db.favoriteRoutes.upsert({
      where: {
        uzytkownikId_przystanekStartId_przystanekKoniecId: {
          uzytkownikId: user.id,
          przystanekStartId,
          przystanekKoniecId,
        },
      },
      update: {},
      create: {
        uzytkownikId: user.id,
        przystanekStartId,
        przystanekKoniecId,
      },
      include: {
        przystanekStart: true,
        przystanekKoniec: true,
      },
    });

    return NextResponse.json(favoriteRoute, { status: 201 });
  } catch (error) {
    console.error("Error creating favorite route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - deleted fav route
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email! },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing id parameter" },
        { status: 400 }
      );
    }

    const favoriteRoute = await db.favoriteRoutes.findUnique({
      where: { id: parseInt(id) },
    });

    if (!favoriteRoute) {
      return NextResponse.json(
        { error: "Favorite route not found" },
        { status: 404 }
      );
    }

    // Check if the route belongs to the user
    if (favoriteRoute.uzytkownikId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    await db.favoriteRoutes.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json(
      { message: "Favorite route deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting favorite route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
