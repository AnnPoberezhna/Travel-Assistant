import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/lib/db";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user with statistics
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        favoriteRoutes: true,
        _count: {
          select: {
            favoriteRoutes: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // Get search history count for this user
    const searchHistoryCount = await db.searchHistory.count({
      where: { userId: user.id },
    });

    // Return user data without password
    const { password, ...userWithoutPassword } = user;

    return NextResponse.json({
      id: userWithoutPassword.id,
      email: userWithoutPassword.email,
      username: userWithoutPassword.username,
      role: userWithoutPassword.role,
      createdAt: userWithoutPassword.createdAt,
      favoriteRoutesCount: userWithoutPassword._count.favoriteRoutes,
      searchHistoryCount,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}
