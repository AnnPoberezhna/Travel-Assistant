-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "UlubioneTrasy" (
    "ulubiona_trasa_id" SERIAL NOT NULL,
    "uzytkownik_id" INTEGER NOT NULL,
    "przystanek_start_id" INTEGER NOT NULL,
    "przystanek_koniec_id" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UlubioneTrasy_pkey" PRIMARY KEY ("ulubiona_trasa_id")
);

-- CreateIndex
CREATE INDEX "UlubioneTrasy_uzytkownik_id_idx" ON "UlubioneTrasy"("uzytkownik_id");

-- CreateIndex
CREATE UNIQUE INDEX "UlubioneTrasy_uzytkownik_id_przystanek_start_id_przystanek__key" ON "UlubioneTrasy"("uzytkownik_id", "przystanek_start_id", "przystanek_koniec_id");

-- AddForeignKey
ALTER TABLE "UlubioneTrasy" ADD CONSTRAINT "UlubioneTrasy_uzytkownik_id_fkey" FOREIGN KEY ("uzytkownik_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UlubioneTrasy" ADD CONSTRAINT "UlubioneTrasy_przystanek_start_id_fkey" FOREIGN KEY ("przystanek_start_id") REFERENCES "Przystanek"("przystanek_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UlubioneTrasy" ADD CONSTRAINT "UlubioneTrasy_przystanek_koniec_id_fkey" FOREIGN KEY ("przystanek_koniec_id") REFERENCES "Przystanek"("przystanek_id") ON DELETE CASCADE ON UPDATE CASCADE;
