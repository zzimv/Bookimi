-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Audience" ADD VALUE 'TEEN';
ALTER TYPE "Audience" ADD VALUE 'PET';

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "artStyles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "heroKind" TEXT NOT NULL DEFAULT 'child',
ADD COLUMN     "occasions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "segments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "textStyle" TEXT;

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "mood" TEXT;

