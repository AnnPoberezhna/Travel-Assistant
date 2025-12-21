import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/lib/db";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { username, email } = body;

    if (!username || !email) {
      return NextResponse.json(
        { message: "Username and email are required" },
        { status: 400 }
      );
    }

    // Get current user
    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // Check if new email is already taken by another user
    if (email !== currentUser.email) {
      const existingUserByEmail = await db.user.findUnique({
        where: { email: email },
      });

      if (existingUserByEmail) {
        return NextResponse.json(
          { message: "Email is already in use" },
          { status: 409 }
        );
      }
    }

    // Check if new username is already taken by another user
    if (username !== currentUser.username) {
      const existingUserByUsername = await db.user.findUnique({
        where: { username: username },
      });

      if (existingUserByUsername) {
        return NextResponse.json(
          { message: "Username is already in use" },
          { status: 409 }
        );
      }
    }

    // Update user
    const updatedUser = await db.user.update({
      where: { email: session.user.email },
      data: {
        username,
        email,
      },
    });

    return NextResponse.json(
      {
        message: "Profile updated successfully",
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}
