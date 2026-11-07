import { NextRequest, NextResponse } from "next/server";
import { getVehicles, type VehicleType } from "@/app/lib/warsawApi";
import { warsawApiErrorResponse } from "@/app/lib/apiErrors";

// GET /api/vehicles – pozycje autobusów i tramwajów na żywo (API Warszawy)
//   ?type=bus | tram        (domyślnie oba)
//   ?line=523               (opcjonalnie numer linii)
//   ?brigade=3              (opcjonalnie brygada)
//   ?maxAge=300             (odrzuć pozycje starsze niż N sekund, 0 = bez limitu)
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const typeParam = params.get("type");
  let type: VehicleType | undefined;
  if (typeParam === "bus" || typeParam === "tram") type = typeParam;
  else if (typeParam && typeParam !== "all") {
    return NextResponse.json({ error: "Parametr type musi mieć wartość bus, tram albo all" }, { status: 400 });
  }

  const maxAgeParam = params.get("maxAge");
  const maxAgeSeconds = maxAgeParam === null ? undefined : Number(maxAgeParam);
  if (maxAgeSeconds !== undefined && (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds < 0)) {
    return NextResponse.json({ error: "Parametr maxAge musi być liczbą sekund ≥ 0" }, { status: 400 });
  }

  try {
    const vehicles = await getVehicles({
      type,
      line: params.get("line") ?? undefined,
      brigade: params.get("brigade") ?? undefined,
      maxAgeSeconds,
    });
    return NextResponse.json({
      count: vehicles.length,
      fetchedAt: new Date().toISOString(),
      vehicles,
    });
  } catch (error) {
    return warsawApiErrorResponse(error);
  }
}
