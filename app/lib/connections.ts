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
  now: Date,
  limit = 20
): Promise<DirectConnectionResult[]> {
  // 1) wszystkie „nogi” z przystanku startowego
  // cast prisma to any for property access so TypeScript doesn't depend on generated client shape
  const startLegs: StartLeg[] = await (prisma as any).trasa.findMany({
    where: {
      przystanekId: startStopId,
      przyjazdDt: { gte: now },
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
