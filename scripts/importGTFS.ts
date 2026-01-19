import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import AdmZip from 'adm-zip';

const prisma = new PrismaClient();

// Alternatywne GTFS źródła:
// DZIAŁAJĄCE:
// Warszawa (mkuran.pl): https://mkuran.pl/gtfs/warsaw.zip - 94MB, aktualizowane codziennie
// 
// NIE DZIAŁAJĄ:
// Wrocław MPK: https://www.wroclaw.pl/open-data/opendata/pozatransportowe/gtfs/wroclaw.zip - 404
// Kraków JakDojade: https://www.jakdojade.pl/data/gtfs.zip - invalid format
// Gdańsk: https://www.zdmigdansk.pl/en/open-data/ - wymaga ręcznego pobierania

const GTFS_URL = 'https://mkuran.pl/gtfs/warsaw.zip';
const TEMP_DIR = path.join(process.cwd(), 'temp-gtfs');
const GTFS_ZIP = path.join(TEMP_DIR, 'wroclaw.zip');
const GTFS_EXTRACT_DIR = path.join(TEMP_DIR, 'extracted');

interface Stop {
  stop_id: string;
  stop_code?: string;
  stop_name: string;
  stop_desc?: string;
  stop_lat: string;
  stop_lon: string;
  zone_id?: string;
  stop_url?: string;
}

interface Agency {
  agency_id?: string;
  agency_name: string;
  agency_url?: string;
  agency_timezone?: string;
  agency_lang?: string;
  agency_phone?: string;
}

interface Route {
  route_id: string;
  agency_id?: string;
  route_short_name?: string;
  route_long_name?: string;
  route_desc?: string;
  route_type: string;
  route_url?: string;
  route_color?: string;
}

interface Trip {
  route_id: string;
  service_id: string;
  trip_id: string;
  trip_headsign?: string;
  direction_id?: string;
}

interface StopTime {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: string;
  stop_headsign?: string;
}

async function downloadGTFS() {
  console.log('📥 Pobieranie GTFS z MPK Wrocław...');
  
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  try {
    const response = await axios({
      method: 'get',
      url: GTFS_URL,
      responseType: 'stream',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Travel-Assistant)'
      }
    });

    await pipeline(response.data, createWriteStream(GTFS_ZIP));
    console.log('✅ Pobrany GTFS');
  } catch (error) {
    console.error('❌ Błąd pobierania:', error);
    throw error;
  }
}

async function extractGTFS() {
  console.log('📦 Rozpakowywanie GTFS...');
  
  if (fs.existsSync(GTFS_EXTRACT_DIR)) {
    fs.rmSync(GTFS_EXTRACT_DIR, { recursive: true });
  }

  const zip = new AdmZip(GTFS_ZIP);
  zip.extractAllTo(GTFS_EXTRACT_DIR, true);
  console.log('✅ Rozpakowany GTFS');
}

async function importStops() {
  console.log('🛑 Importowanie przystanków...');
  
  const stopsFile = path.join(GTFS_EXTRACT_DIR, 'stops.txt');
  if (!fs.existsSync(stopsFile)) {
    throw new Error('stops.txt nie znaleziony');
  }

  const content = fs.readFileSync(stopsFile, 'utf-8');
  const stops = parse(content, { columns: true }) as Stop[];

  // Importuj wszystkie przystanki z feedu (pełne pokrycie tras)
  const stopsToImport = stops;
  const stopIdMap = new Map<string, number>(); // GTFS stop_id -> DB Przystanek.id
  let created = 0;
  for (const stop of stopsToImport) {
    try {
      const latitude = parseFloat(stop.stop_lat);
      const longitude = parseFloat(stop.stop_lon);

      if (isNaN(latitude) || isNaN(longitude)) {
        console.warn(`⚠️  Pominięto przystanek ${stop.stop_name} - brak współrzędnych`);
        continue;
      }

      const createdStop = await prisma.przystanek.create({
        data: {
          nazwa: stop.stop_name,
          latitude,
          longitude,
          adres: stop.stop_desc || stop.stop_name
        }
      });

      stopIdMap.set(stop.stop_id, createdStop.id);
      created++;
      
      if (created % 50 === 0) {
        console.log(`  ✓ Zapisano ${created}/${stopsToImport.length}`);
      }
    } catch (error) {
      console.warn(`⚠️  Błąd importu przystanku ${stop.stop_name}:`, error);
    }
  }

  console.log(`✅ Importowano ${created}/${stopsToImport.length} przystanków`);
  return stopIdMap;
}

async function importAgencies() {
  console.log('🏢 Importowanie przewoźników (agencies)...');
  
  const agencyFile = path.join(GTFS_EXTRACT_DIR, 'agency.txt');
  if (!fs.existsSync(agencyFile)) {
    console.warn('⚠️  agency.txt nie znaleziony, tworzę domyślnego przewoźnika...');
    // Jeśli brak agency.txt, utwórz domyślnego przewoźnika
    const agency = await prisma.przewoznik.create({
      data: {
        nazwa: 'ZTM Warszawa',
        typ: 'BUS',
        kraj: 'PL',
        kontakt: ''
      }
    });
    const map = new Map<string, number>();
    map.set('1', agency.id);
    console.log('✅ Utworzono domyślnego przewoźnika');
    return map;
  }

  const content = fs.readFileSync(agencyFile, 'utf-8');
  const agencies = parse(content, { columns: true }) as Agency[];

  const agencyIdMap = new Map<string, number>(); // GTFS agency_id -> DB przewoznik ID

  for (const agency of agencies) {
    try {
      const przewoznik = await prisma.przewoznik.create({
        data: {
          nazwa: agency.agency_name,
          typ: 'BUS', // Domyślnie BUS, będzie nadpisany przez routes
          kraj: 'PL',
          kontakt: agency.agency_phone || agency.agency_url || ''
        }
      });

      const agencyId = agency.agency_id || '1';
      agencyIdMap.set(agencyId, przewoznik.id);
    } catch (error: any) {
      console.warn(`⚠️  Błąd importu agency ${agency.agency_name}:`, error.message);
    }
  }

  console.log(`✅ Importowano ${agencyIdMap.size} przewoźników\n`);
  return agencyIdMap;
}

async function importRoutes(agencyIdMap: Map<string, number>) {
  console.log('🚌 Importowanie linii (routes)...');
  
  const routesFile = path.join(GTFS_EXTRACT_DIR, 'routes.txt');
  if (!fs.existsSync(routesFile)) {
    throw new Error('routes.txt nie znaleziony');
  }

  const content = fs.readFileSync(routesFile, 'utf-8');
  const routes = parse(content, { columns: true }) as Route[];

  // LIMIT: Tylko pierwsze 500 linii (szersze pokrycie)
  const routesToImport = routes.slice(0, 500);

  // Mapa typów transportu GTFS na nasze typy
  const getTransportType = (routeType: string) => {
    const type = parseInt(routeType);
    switch (type) {
      case 0: return 'TRAM';      // Tram
      case 1: return 'RAIL';      // Subway
      case 2: return 'RAIL';      // Rail
      case 3: return 'BUS';       // Bus
      case 4: return 'BUS';       // Ferry
      default: return 'OTHER';
    }
  };

  let created = 0;
  const routeIdMap = new Map<string, number>(); // GTFS route_id -> DB polaczenie ID

  for (const route of routesToImport) {
    try {
      const nazwa = route.route_short_name || route.route_long_name || `Route ${route.route_id}`;
      const typ = getTransportType(route.route_type);

      // Znajdź przewoźnika dla tej route
      const agencyId = route.agency_id || '1';
      const przewoznikId = agencyIdMap.get(agencyId);

      if (!przewoznikId) {
        console.warn(`⚠️  Brak przewoźnika dla agency_id: ${agencyId}`);
        continue;
      }

      // Utwórz POŁĄCZENIE (nie przewoźnika!)
      const polaczenie = await prisma.polaczenie.create({
        data: {
          przewoznikId: przewoznikId,
          nazwa: nazwa,
          typ: typ as any
        }
      });

      routeIdMap.set(route.route_id, polaczenie.id);
      created++;
      
      if (created % 20 === 0) {
        console.log(`  ✓ Zapisano ${created}/${routesToImport.length}`);
      }
    } catch (error) {
      console.warn(`⚠️  Błąd importu linii ${route.route_short_name}:`, error);
    }
  }

  console.log(`✅ Importowano ${created}/${routesToImport.length} linii\n`);
  return routeIdMap;
}

async function importConnections(routeIdMap: Map<string, number>, stopIdMap: Map<string, number>) {
  console.log('🔗 Importowanie połączeń i tras...');
  
  const tripsFile = path.join(GTFS_EXTRACT_DIR, 'trips.txt');
  const stopTimesFile = path.join(GTFS_EXTRACT_DIR, 'stop_times.txt');

  if (!fs.existsSync(tripsFile) || !fs.existsSync(stopTimesFile)) {
    throw new Error('trips.txt lub stop_times.txt nie znaleziony');
  }

  // Wczytaj trips
  const tripsContent = fs.readFileSync(tripsFile, 'utf-8');
  const trips = parse(tripsContent, { columns: true }) as Trip[];

  // Wczytaj stop_times
  const stopTimesContent = fs.readFileSync(stopTimesFile, 'utf-8');
  const stopTimes = parse(stopTimesContent, { columns: true }) as StopTime[];

  // Grupuj stop times po trip_id
  const stopTimesByTrip = new Map<string, StopTime[]>();
  for (const st of stopTimes) {
    if (!stopTimesByTrip.has(st.trip_id)) {
      stopTimesByTrip.set(st.trip_id, []);
    }
    stopTimesByTrip.get(st.trip_id)!.push(st);
  }

  // Sortuj po stop_sequence
  for (const times of stopTimesByTrip.values()) {
    times.sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
  }

  let createdTrips = 0;
  let createdLegs = 0;

  // Oceń pokrycie przystanków dla tripów (ile przystanków mamy w stopIdMap)
  const scoredTrips = trips.map(t => {
    const times = stopTimesByTrip.get(t.trip_id) || [];
    const knownCount = times.reduce((acc, st) => acc + (stopIdMap.has(st.stop_id) ? 1 : 0), 0);
    return { trip: t, knownCount };
  });

  // Zbuduj listę tripów per route, wybierz najlepsze (największe pokrycie) do 8 na linię
  const tripsByRoute = new Map<string, Trip[]>();
  for (const { trip, knownCount } of scoredTrips) {
    if (!routeIdMap.has(trip.route_id)) continue;
    if (knownCount < 2) continue; // potrzebujemy co najmniej 2 znane przystanki
    const arr = tripsByRoute.get(trip.route_id) || [];
    arr.push(trip);
    tripsByRoute.set(trip.route_id, arr);
  }

  const tripsToImport: { trip: Trip; idx: number }[] = [];
  for (const [routeId, tripList] of tripsByRoute.entries()) {
    // posortuj tripy tej linii po pokryciu
    const sorted = tripList
      .map(t => ({
        trip: t,
        known: (stopTimesByTrip.get(t.trip_id) || []).reduce((acc, st) => acc + (stopIdMap.has(st.stop_id) ? 1 : 0), 0)
      }))
      .sort((a, b) => b.known - a.known);

    const take = sorted.slice(0, 8); // do 8 tripów na linię
    take.forEach((t, idx) => tripsToImport.push({ trip: t.trip, idx }));
  }

  // importuj wszystkie dostępne tripy
  const finalTrips = tripsToImport;

  // Importuj trip'y jako połączenia (kilka tripów na route z offsetem kolejności)
  for (const { trip, idx } of finalTrips) {
    try {
      const polaczenieId = routeIdMap.get(trip.route_id);
      const times = stopTimesByTrip.get(trip.trip_id) || [];

      if (times.length === 0) continue;

      // Sprawdź czy połączenie istnieje (używamy mapy route -> polaczenie)
      if (!polaczenieId) {
        console.warn(`⚠️  Route ${trip.route_id} nie w mapie`);
        continue;
      }

      // Trip to konkretna TRASA w ramach połączenia/linii
      // Nie tworzymy nowego polaczenia, tylko nogi tras dla istniejącego


      // Importuj nogi trasy
      for (const stopTime of times) {
        try {
          const przystanekDbId = stopIdMap.get(stopTime.stop_id);
          if (!przystanekDbId) {
            // Przystanek niezaimportowany — pomijamy ten punkt trasy
            continue;
          }
          const sequenceBase = parseInt(stopTime.stop_sequence);
          // Offset aby uniknąć kolizji unikalności dla wielu tripów tej samej linii
          const sequence = sequenceBase + idx * 10000;

          // Parse czasu
          const timeParts = (stopTime.departure_time || stopTime.arrival_time).split(':');
          const hours = parseInt(timeParts[0]);
          const minutes = parseInt(timeParts[1]);
          const now = new Date();
          const arrivalTime = new Date(now);
          arrivalTime.setHours(hours % 24, minutes, 0, 0); // % 24 bo GTFS może mieć 25:00

          await prisma.trasa.create({
            data: {
              polaczenieId: polaczenieId,
              przystanekId: przystanekDbId,
              kolejnosc: sequence,
              przyjazdDt: arrivalTime
            }
          });

          createdLegs++;
        } catch (error) {
          // Loguj istotne błędy (np. unikalność)
          const code = (error as any)?.code;
          if (code === 'P2002') {
            // naruszenie unikalności — pomijamy
          } else {
            // Inne błędy pokaż
            console.warn(`⚠️  Błąd dodawania nogi dla trip ${trip.trip_id}:`, (error as any)?.message || error);
          }
        }
      }

      createdTrips++;
      if (createdTrips % 5 === 0) {
        console.log(`  📍 Przetworzono ${createdTrips}/${tripsToImport.length} tras...`);
      }
    } catch (error) {
      console.warn(`⚠️  Błąd importu trip'u ${trip.trip_id}:`, error);
    }
  }

  console.log(`✅ Importowano ${createdTrips} tras z ${createdLegs} nogami\n`);
}

async function cleanup() {
  console.log('🧹 Czyszczenie tymczasowych plików...');
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true });
  }
  console.log('✅ Wyczyszczono');
}

async function clearDatabase() {
  console.log('🗑️  Czyszczenie starej bazy (trasy, połączenia, przystanki)...');
  await prisma.$transaction([
    prisma.trasa.deleteMany(),
    prisma.polaczenie.deleteMany(),
    prisma.przewoznik.deleteMany(),
    prisma.przystanek.deleteMany(),
    prisma.favoriteRoutes.deleteMany(),
    prisma.searchHistory.deleteMany(),
  ]);
  console.log('✅ Wyczyszczono\n');
}

async function main() {
  try {
    console.log('🚀 IMPORT GTFS MPK WROCŁAW\n');
    console.time('Całkowity czas');

    // Usuń stare dane
    await clearDatabase();

    // Pobierz i rozpakuj
    await downloadGTFS();
    await extractGTFS();

    // Importuj dane
    const stopIdMap = await importStops();
    const agencyIdMap = await importAgencies();
    const routeIdMap = await importRoutes(agencyIdMap);
    await importConnections(routeIdMap, stopIdMap);

    console.log('\n✅ IMPORT UKOŃCZONY POMYŚLNIE!');
    console.timeEnd('Całkowity czas');
  } catch (error) {
    console.error('\n❌ BŁĄD:', error);
    process.exit(1);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main();
