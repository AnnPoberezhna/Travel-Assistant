import { NextResponse } from "next/server";
import { WarsawApiError } from "@/app/lib/warsawApi";

/** Converts a Warsaw API error into a JSON response with the appropriate HTTP status code. */
export function warsawApiErrorResponse(error: unknown) {
  if (error instanceof WarsawApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Nieoczekiwany błąd API Warszawy:", error);
  return NextResponse.json({ error: "Wewnętrzny błąd serwera" }, { status: 500 });
}
