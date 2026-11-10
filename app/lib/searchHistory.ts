import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/db";

/**
 * Saves a route search between two stops in the history of the logged-in user
 * (shown on the History page). Anonymous searches are not saved. Never throws:
 * a failed history write must not break the search itself.
 */
export async function logRouteSearch(startId: number, endId: number, resultsCount: number): Promise<void> {
  try {
    const session = await getServerSession(authOptions);
    const userId = Number(session?.user?.id);
    if (!Number.isInteger(userId) || userId <= 0) return;

    const stops = await prisma.przystanek.findMany({
      where: { id: { in: [startId, endId] } },
      select: { id: true, nazwa: true, ztmStopNr: true },
    });
    // Same names as in the From / To fields ("Centrum 01")
    const nameOf = (id: number) => {
      const s = stops.find((x) => x.id === id);
      return s ? (s.ztmStopNr ? `${s.nazwa} ${s.ztmStopNr}` : s.nazwa) : null;
    };
    const fromText = nameOf(startId);
    const toText = nameOf(endId);

    await prisma.searchHistory.create({
      data: { userId, query: `${fromText ?? startId} -> ${toText ?? endId}`, fromText, toText, resultsCount },
    });
  } catch (error) {
    console.error("Failed to save search history:", error);
  }
}
