-- CreateEnum
CREATE TYPE "TransportType" AS ENUM ('RAIL', 'BUS', 'TRAM', 'OTHER');

-- CreateTable
CREATE TABLE "Przystanek" (
    "przystanek_id" SERIAL NOT NULL,
    "nazwa" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "adres" TEXT,

    CONSTRAINT "Przystanek_pkey" PRIMARY KEY ("przystanek_id")
);

-- CreateTable
CREATE TABLE "Przewoznik" (
    "przewoznik_id" SERIAL NOT NULL,
    "nazwa" TEXT NOT NULL,
    "typ" "TransportType" NOT NULL,
    "kraj" TEXT,
    "kontakt" TEXT,

    CONSTRAINT "Przewoznik_pkey" PRIMARY KEY ("przewoznik_id")
);

-- CreateTable
CREATE TABLE "Polaczenie" (
    "polaczenie_id" SERIAL NOT NULL,
    "przewoznikId" INTEGER NOT NULL,
    "nazwa" TEXT,
    "typ" "TransportType" NOT NULL,

    CONSTRAINT "Polaczenie_pkey" PRIMARY KEY ("polaczenie_id")
);

-- CreateTable
CREATE TABLE "Trasa" (
    "ppr_id" SERIAL NOT NULL,
    "polaczenieId" INTEGER NOT NULL,
    "przystanekId" INTEGER NOT NULL,
    "kolejnosc" INTEGER NOT NULL,
    "przyjazd_dt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trasa_pkey" PRIMARY KEY ("ppr_id")
);

-- CreateIndex
CREATE INDEX "Trasa_przystanekId_idx" ON "Trasa"("przystanekId");

-- CreateIndex
CREATE INDEX "Trasa_polaczenieId_idx" ON "Trasa"("polaczenieId");

-- AddForeignKey
ALTER TABLE "Polaczenie" ADD CONSTRAINT "Polaczenie_przewoznikId_fkey" FOREIGN KEY ("przewoznikId") REFERENCES "Przewoznik"("przewoznik_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trasa" ADD CONSTRAINT "Trasa_polaczenieId_fkey" FOREIGN KEY ("polaczenieId") REFERENCES "Polaczenie"("polaczenie_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trasa" ADD CONSTRAINT "Trasa_przystanekId_fkey" FOREIGN KEY ("przystanekId") REFERENCES "Przystanek"("przystanek_id") ON DELETE RESTRICT ON UPDATE CASCADE;
