// src/lib/connections.ts
import { prisma } from "@/app/lib/db";

type DirectConnectionResult = {
  polaczenieId: number;
  startStopId: number;
  endStopId: number;
  startTime: Date;
  endTime: Date;
  przewoznikName: string;
};

// Lightweight local types matching the selected payloads from Prisma
type StartLeg = {
  polaczenieId: number;
  przystanekId: number;
  przyjazdDt: Date;
  kolejnosc: number;
  polaczenie: { id: number; przewoznik: { nazwa: string } };
};

type EndLeg = {
  polaczenieId: number;
  przystanekId: number;
  przyjazdDt: Date;
  kolejnosc: number;
};

export async function findDirectConnections(
  startStopId: number,
  endStopId: number,
  now: Date | null,
  limit = 20
): Promise<DirectConnectionResult[]> {
  // 1) wszystkie „nogi” z przystanku startowego
  const startLegs: StartLeg[] = await (prisma as any).trasa.findMany({
    where: {
      przystanekId: startStopId,
      ...(now ? { przyjazdDt: { gte: now } } : {}),
    },
    select: {
      polaczenieId: true,
      przystanekId: true,
      przyjazdDt: true,
      kolejnosc: true,
      polaczenie: {
        select: {
          id: true,
          przewoznik: {
            select: { nazwa: true },
          },
        },
      },
    },
  });

  if (!startLegs.length) return [];

  // 2) wszystkie „nogi” z przystanku końcowego dla tych samych połączeń
  const polaczenieIds = [...new Set(startLegs.map(l => l.polaczenieId))];

  const endLegs: EndLeg[] = await (prisma as any).trasa.findMany({
    where: {
      polaczenieId: { in: polaczenieIds },
      przystanekId: endStopId,
    },
    select: {
      polaczenieId: true,
      przystanekId: true,
      przyjazdDt: true,
      kolejnosc: true,
    },
  });

  const endByConnection = new Map<number, EndLeg[]>();
  for (const leg of endLegs) {
    const arr = endByConnection.get(leg.polaczenieId) ?? [];
    arr.push(leg);
    endByConnection.set(leg.polaczenieId, arr);
  }

  // 3) składanie wyników: start przed końcem, sortowanie po czasie
  const results: DirectConnectionResult[] = [];

  for (const s of startLegs) {
    const ends = endByConnection.get(s.polaczenieId);
    if (!ends) continue;

    for (const e of ends) {
      if (s.kolejnosc < e.kolejnosc) {
        results.push({
          polaczenieId: s.polaczenieId,
          startStopId,
          endStopId,
          startTime: s.przyjazdDt,
          endTime: e.przyjazdDt,
          przewoznikName: s.polaczenie.przewoznik.nazwa,
        });
      }
    }
  }

  // sortujemy po czasie startu,
  results.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return results.slice(0, limit);
}

type OneTransferResult = {
  firstPolaczenieId: number;
  secondPolaczenieId: number;
  startStopId: number;
  transferStopId: number;
  endStopId: number;
  firstStartTime: Date;
  transferTime: Date;
  endTime: Date;
  firstPrzewoznikName: string;
  secondPrzewoznikName: string;
};

export async function findOneTransferConnections(
  startStopId: number,
  endStopId: number,
  now: Date | null,
  limit = 20
): Promise<OneTransferResult[]> {
  // Find all legs departing from start after now
  const startLegs: StartLeg[] = await (prisma as any).trasa.findMany({
    where: { przystanekId: startStopId, ...(now ? { przyjazdDt: { gte: now } } : {}) },
    select: {
      polaczenieId: true,
      przystanekId: true,
      przyjazdDt: true,
      kolejnosc: true,
      polaczenie: { select: { id: true, przewoznik: { select: { nazwa: true } } } },
    },
  });
  if (!startLegs.length) return [];

  // Build map of stops reachable on first leg (transfer candidates)
  const firstIds = [...new Set(startLegs.map(l => l.polaczenieId))];
  const firstReachable = await (prisma as any).trasa.findMany({
    where: { polaczenieId: { in: firstIds } },
    select: { polaczenieId: true, przystanekId: true, przyjazdDt: true, kolejnosc: true },
  });
  const reachableByConn = new Map<number, EndLeg[]>();
  for (const leg of firstReachable) {
    const arr = reachableByConn.get(leg.polaczenieId) ?? [];
    arr.push(leg);
    reachableByConn.set(leg.polaczenieId, arr);
  }

  // Find all legs arriving to endStop across all connections
  const endLegsAll: EndLeg[] = await (prisma as any).trasa.findMany({
    where: { przystanekId: endStopId },
    select: { polaczenieId: true, przystanekId: true, przyjazdDt: true, kolejnosc: true },
  });
  const endByConnection = new Map<number, EndLeg[]>();
  for (const leg of endLegsAll) {
    const arr = endByConnection.get(leg.polaczenieId) ?? [];
    arr.push(leg);
    endByConnection.set(leg.polaczenieId, arr);
  }

  // For second legs, we need to know operator names
  const secondConnIds = [...endByConnection.keys()];
  const secondConnOperators = await (prisma as any).polaczenie.findMany({
    where: { id: { in: secondConnIds } },
    select: { id: true, przewoznik: { select: { nazwa: true } } },
  });
  const opNameByConn = new Map<number, string>();
  for (const p of secondConnOperators) {
    opNameByConn.set(p.id, p.przewoznik.nazwa);
  }

  const results: OneTransferResult[] = [];

  // Try to chain first leg to a second leg via a common transfer stop
  for (const s of startLegs) {
    const reachable = reachableByConn.get(s.polaczenieId);
    if (!reachable) continue;

    // stops visited after the start leg
    const afterStart = reachable.filter(r => r.kolejnosc > s.kolejnosc);
    for (const transfer of afterStart) {
      // second leg must depart from the same transfer stop after transfer time
      const secondCandidates: EndLeg[] = await (prisma as any).trasa.findMany({
        where: {
          przystanekId: transfer.przystanekId,
          przyjazdDt: { gte: transfer.przyjazdDt },
        },
        select: { polaczenieId: true, przystanekId: true, przyjazdDt: true, kolejnosc: true },
      });

      for (const secStart of secondCandidates) {
        // Must reach endStop on same connection, and transfer start precedes end
        const secEnds = endByConnection.get(secStart.polaczenieId);
        if (!secEnds) continue;
        for (const secEnd of secEnds) {
          if (secStart.kolejnosc < secEnd.kolejnosc) {
            results.push({
              firstPolaczenieId: s.polaczenieId,
              secondPolaczenieId: secStart.polaczenieId,
              startStopId,
              transferStopId: transfer.przystanekId,
              endStopId,
              firstStartTime: s.przyjazdDt,
              transferTime: transfer.przyjazdDt,
              endTime: secEnd.przyjazdDt,
              firstPrzewoznikName: s.polaczenie.przewoznik.nazwa,
              secondPrzewoznikName: opNameByConn.get(secStart.polaczenieId) ?? "",
            });
          }
        }
      }
    }
  }

  results.sort((a, b) => a.firstStartTime.getTime() - b.firstStartTime.getTime());
  return results.slice(0, limit);
}
