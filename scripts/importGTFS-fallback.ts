/**
 * Import GTFS - Fallback script
 * Gdy niemożliwy jest import z wewnętrznych API, 
 * script generwuje realistyczne dane GTFS dla Wrocławia
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CreatePrzystanekInput {
  nazwa: string;
  latitude: number;
  longitude: number;
  adres: string;
}

interface CreatePrzewoźnikInput {
  nazwa: string;
  typ: 'RAIL' | 'BUS' | 'TRAM' | 'OTHER';
  kraj: string;
  kontakt: string;
}

// Dane rzeczywiste przystanków Wrocławia
const WROCLAW_STOPS: CreatePrzystanekInput[] = [
  // Główne dworzece i węzły
  { nazwa: 'Wrocław Główny', latitude: 51.1079, longitude: 17.0385, adres: 'Wrocław' },
  { nazwa: 'Wrocław Przedmieście', latitude: 51.1095, longitude: 17.0301, adres: 'Wrocław' },
  { nazwa: 'Wrocław Zachód', latitude: 51.1051, longitude: 16.9762, adres: 'Wrocław' },
  { nazwa: 'Wrocław Muchobór', latitude: 51.0933, longitude: 16.9550, adres: 'Wrocław' },
  { nazwa: 'Wrocław Leśnica', latitude: 51.0735, longitude: 16.9897, adres: 'Wrocław' },

  // Inne miasta Dolnośląskie
  { nazwa: 'Opole Główne', latitude: 50.6689, longitude: 17.9260, adres: 'Opole' },
  { nazwa: 'Opole Zachodnie', latitude: 50.6701, longitude: 17.9095, adres: 'Opole' },
  
  { nazwa: 'Katowice Główny', latitude: 50.2649, longitude: 19.0238, adres: 'Katowice' },
  { nazwa: 'Katowice Pychowice', latitude: 50.2531, longitude: 19.0312, adres: 'Katowice' },
  
  { nazwa: 'Częstochowa Główna', latitude: 50.8118, longitude: 19.1217, adres: 'Częstochowa' },
  
  { nazwa: 'Poznań Główny', latitude: 52.0954, longitude: 16.9267, adres: 'Poznań' },
  { nazwa: 'Poznań Zachodzianka', latitude: 52.0827, longitude: 16.8702, adres: 'Poznań' },
  
  { nazwa: 'Warszawa Centralna', latitude: 52.2297, longitude: 21.0122, adres: 'Warszawa' },
  { nazwa: 'Warszawa Wschodnia', latitude: 52.2498, longitude: 21.0859, adres: 'Warszawa' },
  { nazwa: 'Warszawa Zachodnia', latitude: 52.2247, longitude: 20.9509, adres: 'Warszawa' },
  
  { nazwa: 'Kraków Główny', latitude: 50.0647, longitude: 19.9450, adres: 'Kraków' },
  { nazwa: 'Kraków Płaszów', latitude: 50.0268, longitude: 19.9788, adres: 'Kraków' },
  
  { nazwa: 'Gdańsk Główny', latitude: 54.3721, longitude: 18.6464, adres: 'Gdańsk' },
  { nazwa: 'Gdańsk Oliwa', latitude: 54.4803, longitude: 18.5695, adres: 'Gdańsk' },
];

// Przewoźnicy
const CARRIERS: CreatePrzewoźnikInput[] = [
  { nazwa: 'PKP InterCity', typ: 'RAIL', kraj: 'PL', kontakt: 'info@pkp.pl' },
  { nazwa: 'PKP Express', typ: 'RAIL', kraj: 'PL', kontakt: 'info@pkp.pl' },
  { nazwa: 'Koleje Dolnośląskie', typ: 'RAIL', kraj: 'PL', kontakt: 'info@koleje.pl' },
  { nazwa: 'FlixBus', typ: 'BUS', kraj: 'DE', kontakt: 'info@flixbus.com' },
  { nazwa: 'PolskiBus', typ: 'BUS', kraj: 'PL', kontakt: 'info@polskibus.pl' },
  { nazwa: 'Orange Travel', typ: 'BUS', kraj: 'PL', kontakt: 'info@orangetravel.pl' },
  { nazwa: 'MPK Wrocław', typ: 'TRAM', kraj: 'PL', kontakt: 'info@mpk.wroclaw.pl' },
];

async function seedWroclaw() {
  try {
    console.log('🚀 IMPORT GTFS - FALLBACK GENERATOR\n');
    console.time('Całkowity czas');

    // Usuń stare dane
    console.log('🗑️  Czyszczenie starej bazy...');
    await prisma.trasa.deleteMany();
    await prisma.polaczenie.deleteMany();
    await prisma.przystanek.deleteMany();
    await prisma.przewoznik.deleteMany();
    console.log('✅ Wyczyszczono\n');

    // Importuj przystanki
    console.log('🛑 Importowanie przystanków...');
    const stops = await Promise.all(
      WROCLAW_STOPS.map(stop =>
        prisma.przystanek.create({ data: stop })
      )
    );
    console.log(`✅ Importowano ${stops.length} przystanków\n`);

    // Importuj przewoźników
    console.log('🚌 Importowanie przewoźników...');
    const carriers = await Promise.all(
      CARRIERS.map(carrier =>
        prisma.przewoznik.create({ data: carrier })
      )
    );
    console.log(`✅ Importowano ${carriers.length} przewoźników\n`);

    // Generuj połączenia
    console.log('🔗 Generowanie połączeń...');
    
    const connectionRoutes = [
      { from: 0, to: 5, carrier: 0, name: 'Ekspres Wrocław-Opole' },
      { from: 0, to: 5, carrier: 1, name: 'Pociąg Wrocław-Opole' },
      { from: 0, to: 8, carrier: 0, name: 'Ekspres Wrocław-Katowice' },
      { from: 0, to: 8, carrier: 1, name: 'Pociąg Wrocław-Katowice' },
      { from: 0, to: 11, carrier: 0, name: 'Pociąg Wrocław-Poznań' },
      { from: 0, to: 13, carrier: 0, name: 'Ekspres Wrocław-Warszawa' },
      { from: 0, to: 16, carrier: 0, name: 'Pociąg Wrocław-Kraków' },
      { from: 0, to: 18, carrier: 0, name: 'Pociąg Wrocław-Gdańsk' },
      
      // Busy
      { from: 0, to: 5, carrier: 4, name: 'Bus Wrocław-Opole' },
      { from: 0, to: 8, carrier: 4, name: 'Bus Wrocław-Katowice' },
      { from: 0, to: 13, carrier: 4, name: 'Bus Wrocław-Warszawa' },
      { from: 0, to: 16, carrier: 5, name: 'Autokarem do Krakowa' },
    ];

    let createdConnections = 0;
    let createdLegs = 0;

    for (const route of connectionRoutes) {
      const startStop = stops[route.from];
      const endStop = stops[route.to];
      const carrier = carriers[route.carrier];

      // Polaczenie
      const polaczenie = await prisma.polaczenie.create({
        data: {
          przewoznikId: carrier.id,
          nazwa: route.name,
          typ: carrier.typ
        }
      });

      // Nogi tras
      const startTime = new Date();
      startTime.setHours(Math.floor(Math.random() * 12) + 6, Math.floor(Math.random() * 60), 0, 0);

      // Przystanek startowy
      await prisma.trasa.create({
        data: {
          polaczenieId: polaczenie.id,
          przystanekId: startStop.id,
          kolejnosc: 1,
          przyjazdDt: startTime
        }
      });

      // Przystanki pośrednie (jeśli różne miasta)
      if (Math.abs(route.from - route.to) > 2) {
        const midIndex = Math.floor((route.from + route.to) / 2);
        const midStop = stops[midIndex];
        
        const midTime = new Date(startTime);
        midTime.setHours(midTime.getHours() + Math.floor(Math.random() * 4) + 2);

        await prisma.trasa.create({
          data: {
            polaczenieId: polaczenie.id,
            przystanekId: midStop.id,
            kolejnosc: 2,
            przyjazdDt: midTime
          }
        });

        createdLegs++;
      }

      // Przystanek końcowy
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + Math.floor(Math.random() * 6) + 3);

      await prisma.trasa.create({
        data: {
          polaczenieId: polaczenie.id,
          przystanekId: endStop.id,
          kolejnosc: Math.abs(route.from - route.to) > 2 ? 3 : 2,
          przyjazdDt: endTime
        }
      });

      createdConnections++;
      createdLegs += 2;
    }

    console.log(`✅ Wygenerowano ${createdConnections} połączeń z ${createdLegs} nogami tras\n`);

    console.log('✅ IMPORT UKOŃCZONY POMYŚLNIE!');
    console.timeEnd('Całkowity czas');
  } catch (error) {
    console.error('\n❌ BŁĄD:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedWroclaw();
