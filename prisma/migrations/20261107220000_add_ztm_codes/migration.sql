-- AlterTable
ALTER TABLE "Przystanek" ADD COLUMN     "ztmStopId" TEXT,
ADD COLUMN     "ztmStopNr" TEXT;

-- AlterTable
ALTER TABLE "Trasa" ADD COLUMN     "wariant" TEXT;
