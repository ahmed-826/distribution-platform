/*
  Warnings:

  - You are about to drop the column `userId` on the `Upload` table. All the data in the column will be lost.
  - Added the required column `creatorId` to the `Upload` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Upload" DROP CONSTRAINT "Upload_userId_fkey";

-- AlterTable
ALTER TABLE "Upload" DROP COLUMN "userId",
ADD COLUMN     "creatorId" UUID NOT NULL,
ADD COLUMN     "processorId" UUID;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
