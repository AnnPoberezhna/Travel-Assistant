// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helpers
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function randomUsername(base, i) {
  return (
    base.toLowerCase().replace(/[^a-z0-9]/gi, '') +
    String(i).padStart(2, '0')
  );
}

// Remove Polish diacritics and any combining marks, collapse spaces
function stripDiacritics(str) {
  if (!str) return str;
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .replace(/ś/g, 's')
    .replace(/Ś/g, 'S')
    .replace(/ć/g, 'c')
    .replace(/Ć/g, 'C')
    .replace(/ź/g, 'z')
    .replace(/Ź/g, 'Z')
    .replace(/ż/g, 'z')
    .replace(/Ż/g, 'Z')
    .replace(/ń/g, 'n')
    .replace(/Ń/g, 'N')
    .replace(/ą/g, 'a')
    .replace(/Ą/g, 'A')
    .replace(/ę/g, 'e')
    .replace(/Ę/g, 'E')
    .replace(/ó/g, 'o')
    .replace(/Ó/g, 'O')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.time('seed');

  // 1. Czyścimy dane w odpowiedniej kolejności (FK!)
  await prisma.favoriteRoutes.deleteMany();
  await prisma.searchHistory.deleteMany();
  await prisma.trasa.deleteMany();
  await prisma.polaczenie.deleteMany();
  await prisma.przystanek.deleteMany();
  await prisma.przewoznik.deleteMany();
  await prisma.user.deleteMany();

  const now = new Date();

  // 2. PRZEWOŹNICY – ~15 sztuk
  const przewoznicyData = [
    { nazwa: 'PKP Intercity', typ: 'RAIL', kraj: 'PL', kontakt: 'kontakt@pkp-intercity.pl' },
    { nazwa: 'Polregio', typ: 'RAIL', kraj: 'PL', kontakt: 'info@polregio.pl' },
    { nazwa: 'Koleje Dolnośląskie', typ: 'RAIL', kraj: 'PL', kontakt: 'biuro@kolejedolnoslaskie.eu' },
    { nazwa: 'Koleje Mazowieckie', typ: 'RAIL', kraj: 'PL', kontakt: 'kontakt@mazowieckie.com.pl' },
    { nazwa: 'Koleje Śląskie', typ: 'RAIL', kraj: 'PL', kontakt: 'biuro@kolejeslaskie.com' },
    { nazwa: 'Koleje Wielkopolskie', typ: 'RAIL', kraj: 'PL', kontakt: 'info@koleje-wielkopolskie.com' },
    { nazwa: 'SKM Trójmiasto', typ: 'RAIL', kraj: 'PL', kontakt: 'biuro@skm.pkp.pl' },
    { nazwa: 'Łódzka Kolej Aglomeracyjna', typ: 'RAIL', kraj: 'PL', kontakt: 'kontakt@lka.lodzkie.pl' },
    { nazwa: 'Koleje Małopolskie', typ: 'RAIL', kraj: 'PL', kontakt: 'info@kolejemalopolskie.com.pl' },
    { nazwa: 'Koleje Lubelskie', typ: 'RAIL', kraj: 'PL', kontakt: 'biuro@kolejelubelskie.pl' },
    { nazwa: 'Koleje Podkarpackie', typ: 'RAIL', kraj: 'PL', kontakt: 'info@kolejepodkarpackie.pl' },
    { nazwa: 'Koleje Pomorskie', typ: 'RAIL', kraj: 'PL', kontakt: 'kontakt@kolejepomorskie.pl' },
    { nazwa: 'Koleje Zachodniopomorskie', typ: 'RAIL', kraj: 'PL', kontakt: 'info@kolejezachodniopomorskie.pl' },
    { nazwa: 'Koleje Opolskie', typ: 'RAIL', kraj: 'PL', kontakt: 'biuro@kolejeopolskie.pl' },
    { nazwa: 'SKM Warszawa', typ: 'RAIL', kraj: 'PL', kontakt: 'kontakt@skm.warszawa.pl' },
  ];

  const przewoznicy = await prisma.$transaction(
    przewoznicyData.map((data) =>
      prisma.przewoznik.create({
        data: {
          ...data,
          nazwa: stripDiacritics(data.nazwa),
          kraj: stripDiacritics(data.kraj),
          kontakt: stripDiacritics(data.kontakt),
        },
      })
    )
  );

  // 3. PRZYSTANKI – ~250 (realne + sztuczne)
  const baseStations = [
    { nazwa: 'Wrocław Główny', latitude: 51.0981, longitude: 17.0366, adres: 'Wrocław' },
    { nazwa: 'Wrocław Mikołajów', latitude: 51.118, longitude: 17.014, adres: 'Wrocław' },
    { nazwa: 'Wrocław Psie Pole', latitude: 51.139, longitude: 17.12, adres: 'Wrocław' },

    { nazwa: 'Warszawa Centralna', latitude: 52.2298, longitude: 21.0038, adres: 'Warszawa' },
    { nazwa: 'Warszawa Wschodnia', latitude: 52.2521, longitude: 21.048, adres: 'Warszawa' },
    { nazwa: 'Warszawa Zachodnia', latitude: 52.2206, longitude: 20.9626, adres: 'Warszawa' },
    { nazwa: 'Warszawa Gdańska', latitude: 52.2585, longitude: 20.988, adres: 'Warszawa' },

    { nazwa: 'Kraków Główny', latitude: 50.0675, longitude: 19.945, adres: 'Kraków' },
    { nazwa: 'Kraków Płaszów', latitude: 50.037, longitude: 19.969, adres: 'Kraków' },

    { nazwa: 'Gdańsk Główny', latitude: 54.352, longitude: 18.6466, adres: 'Gdańsk' },
    { nazwa: 'Gdynia Główna', latitude: 54.5189, longitude: 18.5305, adres: 'Gdynia' },
    { nazwa: 'Sopot', latitude: 54.4416, longitude: 18.56, adres: 'Sopot' },

    { nazwa: 'Poznań Główny', latitude: 52.401, longitude: 16.911, adres: 'Poznań' },
    { nazwa: 'Szczecin Główny', latitude: 53.4285, longitude: 14.5528, adres: 'Szczecin' },
    { nazwa: 'Katowice', latitude: 50.2599, longitude: 19.0216, adres: 'Katowice' },
    { nazwa: 'Gliwice', latitude: 50.2945, longitude: 18.6714, adres: 'Gliwice' },
    { nazwa: 'Zabrze', latitude: 50.305, longitude: 18.79, adres: 'Zabrze' },
    { nazwa: 'Bytom', latitude: 50.348, longitude: 18.915, adres: 'Bytom' },

    { nazwa: 'Łódź Fabryczna', latitude: 51.7592, longitude: 19.455, adres: 'Łódź' },
    { nazwa: 'Łódź Widzew', latitude: 51.757, longitude: 19.498, adres: 'Łódź' },

    { nazwa: 'Lublin Główny', latitude: 51.237, longitude: 22.566, adres: 'Lublin' },
    { nazwa: 'Rzeszów Główny', latitude: 50.0413, longitude: 21.999, adres: 'Rzeszów' },
    { nazwa: 'Białystok', latitude: 53.1325, longitude: 23.1688, adres: 'Białystok' },
    { nazwa: 'Olsztyn Główny', latitude: 53.7784, longitude: 20.4801, adres: 'Olsztyn' },
    { nazwa: 'Opole Główne', latitude: 50.665, longitude: 17.926, adres: 'Opole' },
    { nazwa: 'Zielona Góra Główna', latitude: 51.9356, longitude: 15.5064, adres: 'Zielona Góra' },
    { nazwa: 'Koszalin', latitude: 54.1943, longitude: 16.1722, adres: 'Koszalin' },
    { nazwa: 'Kołobrzeg', latitude: 54.176, longitude: 15.57, adres: 'Kołobrzeg' },
    { nazwa: 'Bielsko-Biała Główna', latitude: 49.8224, longitude: 19.0444, adres: 'Bielsko-Biała' },
    { nazwa: 'Zakopane', latitude: 49.298, longitude: 19.9496, adres: 'Zakopane' },
    { nazwa: 'Przemyśl Główny', latitude: 49.7837, longitude: 22.767, adres: 'Przemyśl' },
    { nazwa: 'Hel', latitude: 54.6065, longitude: 18.799, adres: 'Hel' },
    { nazwa: 'Świnoujście', latitude: 53.9105, longitude: 14.25, adres: 'Świnoujście' },
    { nazwa: 'Legnica', latitude: 51.2101, longitude: 16.1619, adres: 'Legnica' },
    { nazwa: 'Jelenia Góra', latitude: 50.904, longitude: 15.734, adres: 'Jelenia Góra' },
    { nazwa: 'Wałbrzych Miasto', latitude: 50.77, longitude: 16.284, adres: 'Wałbrzych' },
    { nazwa: 'Kłodzko Główne', latitude: 50.439, longitude: 16.661, adres: 'Kłodzko' },
    { nazwa: 'Gorzów Wielkopolski', latitude: 52.7368, longitude: 15.2288, adres: 'Gorzów Wielkopolski' },
    { nazwa: 'Toruń Główny', latitude: 53.01, longitude: 18.598, adres: 'Toruń' },
    { nazwa: 'Bydgoszcz Główna', latitude: 53.1235, longitude: 18.0084, adres: 'Bydgoszcz' },
    { nazwa: 'Radom Główny', latitude: 51.402, longitude: 21.156, adres: 'Radom' },
    { nazwa: 'Kielce', latitude: 50.87, longitude: 20.63, adres: 'Kielce' },
  ];

  const targetStationsCount = 250;
  const przystankiData = [...baseStations];

  let counter = 1;
  while (przystankiData.length < targetStationsCount) {
    const base = baseStations[counter % baseStations.length];
    przystankiData.push({
      ...base,
      nazwa: `${base.nazwa} (${counter})`,
      latitude: base.latitude + (Math.random() - 0.5) * 0.02,
      longitude: base.longitude + (Math.random() - 0.5) * 0.02,
    });
    counter++;
  }

  const przystanki = await prisma.$transaction(
    przystankiData.map((data) =>
      prisma.przystanek.create({
        data: {
          ...data,
          nazwa: stripDiacritics(data.nazwa),
          adres: stripDiacritics(data.adres),
        },
      })
    )
  );

  // 4. POŁĄCZENIA + TRASA
  const targetPolaczeniaCount = 1000;
  const polaczeniaCreated = [];

  const transportTypes = ['RAIL', 'BUS', 'TRAM', 'OTHER'];
  const trainCategories = ['IC', 'TLK', 'EIC', 'EIP', 'R', 'KM', 'KD', 'SKM'];

  for (let i = 0; i < targetPolaczeniaCount; i++) {
    const przewoznik = randomItem(przewoznicy);
    const transportType = randomItem(transportTypes);

    const startStation = randomItem(przystanki);
    let endStation = randomItem(przystanki);
    let guard = 0;
    while (endStation.id === startStation.id && guard < 10) {
      endStation = randomItem(przystanki);
      guard++;
    }

    const category = randomItem(trainCategories);

    const routeNameRaw = `${category} ${startStation.nazwa.split(' ')[0]} - ${endStation.nazwa.split(' ')[0]} #${i + 1}`;
    const routeName = stripDiacritics(routeNameRaw);

    const polaczenie = await prisma.polaczenie.create({
      data: {
        przewoznikId: przewoznik.id,
        nazwa: routeName,
        typ: transportType,
      },
    });

    polaczeniaCreated.push(polaczenie);

    // generujemy przebieg trasy
    const stopsCount = randomInt(3, 8);
    const usedStationIds = new Set();
    const traseStations = [];

    traseStations.push(startStation);
    usedStationIds.add(startStation.id);

    for (let k = 0; k < stopsCount - 2; k++) {
      let station = randomItem(przystanki);
      let safety = 0;
      while (usedStationIds.has(station.id) && safety < 20) {
        station = randomItem(przystanki);
        safety++;
      }
      traseStations.push(station);
      usedStationIds.add(station.id);
    }

    if (!usedStationIds.has(endStation.id)) {
      traseStations.push(endStation);
    } else {
      let newEnd = randomItem(przystanki);
      let safety2 = 0;
      while (usedStationIds.has(newEnd.id) && safety2 < 20) {
        newEnd = randomItem(przystanki);
        safety2++;
      }
      traseStations.push(newEnd);
    }

    let minutesOffset = randomInt(0, 180); // start w najbliższych 3h
    const minBetweenStops = randomInt(20, 90);

    const legs = traseStations.map((station, idx) => {
      if (idx > 0) {
        minutesOffset += minBetweenStops;
      }
      return {
        polaczenieId: polaczenie.id,
        przystanekId: station.id,
        kolejnosc: idx + 1,
        przyjazdDt: new Date(now.getTime() + minutesOffset * 60 * 1000),
      };
    });

    await prisma.$transaction(
      legs.map((leg) => prisma.trasa.create({ data: leg }))
    );
  }

  // 5. UŻYTKOWNICY – sztuczni userzy
  const names = [
    'Filip', 'Anna', 'Bartosz', 'Borys', 'Kuba', 'Marta', 'Kasia',
    'Paweł', 'Ola', 'Karol', 'Natalia', 'Piotr', 'Magda', 'Kacper',
    'Dominika', 'Mikołaj', 'Weronika', 'Tomek', 'Julia', 'Szymon'
  ];

  const usersToCreate = 80;
  const usersData = [];

  for (let i = 0; i < usersToCreate; i++) {
    const baseName = randomItem(names);
    const username = randomUsername(baseName, i);
    usersData.push({
      email: `${username}@example.com`,
      username,
      // w realu miałbyś tu hashe; do sztucznego seeda wystarczy plain
      password: 'password123',
      role: Math.random() < 0.1 ? 'ADMIN' : 'USER',
    });
  }

  const users = await prisma.$transaction(
    usersData.map((data) => prisma.user.create({ data }))
  );

  // 6. HISTORIA WYSZUKIWAŃ – SearchHistory
  const searchHistoryCreates = [];

  for (const user of users) {
    const searchesForUser = randomInt(5, 15);

    for (let i = 0; i < searchesForUser; i++) {
      const fromStation = randomItem(przystanki);
      let toStation = randomItem(przystanki);
      let guard = 0;
      while (toStation.id === fromStation.id && guard < 10) {
        toStation = randomItem(przystanki);
        guard++;
      }

      const query = stripDiacritics(`${fromStation.nazwa} -> ${toStation.nazwa}`);
      const resultsCount = randomInt(0, 20);

      searchHistoryCreates.push(
        prisma.searchHistory.create({
          data: {
            userId: user.id,
            query,
            fromText: stripDiacritics(fromStation.nazwa),
            toText: stripDiacritics(toStation.nazwa),
            resultsCount,
          },
        })
      );
    }
  }

  // + trochę anonimowych wyszukiwań (userId = null)
  const anonymousSearches = 50;
  for (let i = 0; i < anonymousSearches; i++) {
    const fromStation = randomItem(przystanki);
    let toStation = randomItem(przystanki);
    let guard = 0;
    while (toStation.id === fromStation.id && guard < 10) {
      toStation = randomItem(przystanki);
      guard++;
    }

    const query = stripDiacritics(`${fromStation.nazwa} -> ${toStation.nazwa}`);
    const resultsCount = randomInt(0, 20);

    searchHistoryCreates.push(
      prisma.searchHistory.create({
        data: {
          userId: null,
          query,
          fromText: stripDiacritics(fromStation.nazwa),
          toText: stripDiacritics(toStation.nazwa),
          resultsCount,
        },
      })
    );
  }

  await prisma.$transaction(searchHistoryCreates);

  // 7. ULUBIONE TRASY – FavoriteRoutes
  const favoriteRoutesCreates = [];

  for (const user of users) {
    const favCount = randomInt(2, 5);
    const pairSet = new Set(); // żeby nie duplikować dla tego samego usera

    let attempts = 0;
    let createdForUser = 0;

    while (createdForUser < favCount && attempts < favCount * 10) {
      attempts++;

      const startStation = randomItem(przystanki);
      let endStation = randomItem(przystanki);
      let guard = 0;
      while (endStation.id === startStation.id && guard < 10) {
        endStation = randomItem(przystanki);
        guard++;
      }

      const key = `${startStation.id}-${endStation.id}`;
      if (pairSet.has(key)) continue;

      pairSet.add(key);
      createdForUser++;

      favoriteRoutesCreates.push(
        prisma.favoriteRoutes.create({
          data: {
            uzytkownikId: user.id,
            przystanekStartId: startStation.id,
            przystanekKoniecId: endStation.id,
          },
        })
      );
    }
  }

  await prisma.$transaction(favoriteRoutesCreates);

  console.timeEnd('seed');
  console.log('Seed complete.');
  console.log({
    przewoznikCount: przewoznicy.length,
    przystanekCount: przystanki.length,
    polaczenieCount: polaczeniaCreated.length,
    userCount: users.length,
    searchHistoryCount: searchHistoryCreates.length,
    favoriteRoutesCount: favoriteRoutesCreates.length,
  });
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
