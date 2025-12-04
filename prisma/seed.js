const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // clear existing seeded data to keep seed idempotent for this dev workflow
  await prisma.trasa.deleteMany();
  await prisma.polaczenie.deleteMany();
  await prisma.przystanek.deleteMany();
  await prisma.przewoznik.deleteMany();

  const now = new Date();

  const przew1 = await prisma.przewoznik.create({ data: { nazwa: 'PKP Example', typ: 'RAIL', kraj: 'PL', kontakt: 'info@pkp.example' } });
  const przew2 = await prisma.przewoznik.create({ data: { nazwa: 'Flix Example', typ: 'BUS', kraj: 'PL', kontakt: 'info@flix.example' } });

  const p1 = await prisma.przystanek.create({ data: { nazwa: 'Wroclaw Glowny', latitude: 51.1079, longitude: 17.0385, adres: 'Wrocław' } });
  const p5 = await prisma.przystanek.create({ data: { nazwa: 'Wroclaw Muchobor', latitude: 51.0933, longitude: 16.9550, adres: 'Wrocław' } });
  const p2 = await prisma.przystanek.create({ data: { nazwa: 'Opole Glowna', latitude: 50.6689, longitude: 17.9260, adres: 'Opole' } });
  const p3 = await prisma.przystanek.create({ data: { nazwa: 'Katowice', latitude: 50.2649, longitude: 19.0238, adres: 'Katowice' } });
  const p4 = await prisma.przystanek.create({ data: { nazwa: 'Czestochowa', latitude: 50.8118, longitude: 19.1217, adres: 'Częstochowa' } });

  const polaczenia = [];

  // create multiple rail connections (same route) with staggered departure times
  for (let i = 0; i < 5; i++) {
    const pol = await prisma.polaczenie.create({ data: { przewoznikId: przew1.id, nazwa: `Wroclaw-Katowice Express #${i + 1}`, typ: 'RAIL' } });
    polaczenia.push(pol);

    const legs = [
      { polaczenieId: pol.id, przystanekId: p1.id, kolejnosc: 1, przyjazdDt: new Date(now.getTime() + (30 + i * 60) * 60 * 1000) },
      { polaczenieId: pol.id, przystanekId: p2.id, kolejnosc: 2, przyjazdDt: new Date(now.getTime() + (90 + i * 60) * 60 * 1000) },
      { polaczenieId: pol.id, przystanekId: p3.id, kolejnosc: 3, przyjazdDt: new Date(now.getTime() + (180 + i * 60) * 60 * 1000) },
    ];

    for (const l of legs) {
      await prisma.trasa.create({ data: l });
    }
  }

  // create multiple bus connections (direct Wroclaw -> Katowice) with different times
  for (let i = 0; i < 3; i++) {
    const pol = await prisma.polaczenie.create({ data: { przewoznikId: przew2.id, nazwa: `Wroclaw-Katowice Bus #${i + 1}`, typ: 'BUS' } });
    polaczenia.push(pol);

    const legs = [
      { polaczenieId: pol.id, przystanekId: p1.id, kolejnosc: 1, przyjazdDt: new Date(now.getTime() + (45 + i * 50) * 60 * 1000) },
      { polaczenieId: pol.id, przystanekId: p3.id, kolejnosc: 2, przyjazdDt: new Date(now.getTime() + (160 + i * 50) * 60 * 1000) },
    ];

    for (const l of legs) {
      await prisma.trasa.create({ data: l });
    }
  }

  // additional connections starting from Wroclaw Muchobor -> Katowice (to reflect multiple city stops)
  for (let i = 0; i < 2; i++) {
    const pol = await prisma.polaczenie.create({ data: { przewoznikId: przew1.id, nazwa: `WroclawMuchobor-Katowice #${i + 1}`, typ: 'RAIL' } });
    polaczenia.push(pol);

    const legs = [
      { polaczenieId: pol.id, przystanekId: p5.id, kolejnosc: 1, przyjazdDt: new Date(now.getTime() + (50 + i * 70) * 60 * 1000) },
      { polaczenieId: pol.id, przystanekId: p3.id, kolejnosc: 2, przyjazdDt: new Date(now.getTime() + (140 + i * 70) * 60 * 1000) },
    ];

    for (const l of legs) {
      await prisma.trasa.create({ data: l });
    }
  }

  // a different route involving Czestochowa
  const polOther = await prisma.polaczenie.create({ data: { przewoznikId: przew1.id, nazwa: 'Wroclaw-Czestochowa', typ: 'RAIL' } });
  await prisma.trasa.create({ data: { polaczenieId: polOther.id, przystanekId: p1.id, kolejnosc: 1, przyjazdDt: new Date(now.getTime() + 60 * 60 * 1000) } });
  await prisma.trasa.create({ data: { polaczenieId: polOther.id, przystanekId: p4.id, kolejnosc: 2, przyjazdDt: new Date(now.getTime() + 140 * 60 * 1000) } });

  console.log('Seed complete. IDs:');
  console.log({ przewoznikIds: [przew1.id, przew2.id], przystanki: [p1.id, p5.id, p2.id, p3.id, p4.id], polaczenia: polaczenia.map((p) => p.id) });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
