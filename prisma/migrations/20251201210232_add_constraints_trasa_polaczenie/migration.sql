/*
  Warnings:

  - A unique constraint covering the columns `[przewoznikId,nazwa]` on the table `Polaczenie` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[polaczenieId,kolejnosc]` on the table `Trasa` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Polaczenie" DROP CONSTRAINT "Polaczenie_przewoznikId_fkey";

-- DropForeignKey
ALTER TABLE "Trasa" DROP CONSTRAINT "Trasa_polaczenieId_fkey";

-- DropForeignKey
ALTER TABLE "Trasa" DROP CONSTRAINT "Trasa_przystanekId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "Polaczenie_przewoznikId_nazwa_key" ON "Polaczenie"("przewoznikId", "nazwa");

-- CreateIndex
CREATE UNIQUE INDEX "Trasa_polaczenieId_kolejnosc_key" ON "Trasa"("polaczenieId", "kolejnosc");

-- AddForeignKey
ALTER TABLE "Polaczenie" ADD CONSTRAINT "Polaczenie_przewoznikId_fkey" FOREIGN KEY ("przewoznikId") REFERENCES "Przewoznik"("przewoznik_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trasa" ADD CONSTRAINT "Trasa_polaczenieId_fkey" FOREIGN KEY ("polaczenieId") REFERENCES "Polaczenie"("polaczenie_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trasa" ADD CONSTRAINT "Trasa_przystanekId_fkey" FOREIGN KEY ("przystanekId") REFERENCES "Przystanek"("przystanek_id") ON DELETE CASCADE ON UPDATE CASCADE;
