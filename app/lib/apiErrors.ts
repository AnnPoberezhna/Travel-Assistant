import { NextResponse } from "next/server";
import { WarsawApiError } from "@/app/lib/warsawApi";

/** Zamienia błąd z API Warszawy na odpowiedź JSON z odpowiednim kodem HTTP. */
export function warsawApiErrorResponse(error: unknown) {
  if (error instanceof WarsawApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Nieoczekiwany błąd API Warszawy:", error);
  return NextResponse.json({ error: "Wewnętrzny błąd serwera" }, { status: 500 });
}
