/*
  Warnings:

  - You are about to drop the column `emailId` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `sourcePath` on the `Document` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_emailId_fkey";

-- DropIndex
DROP INDEX "Document_sourcePath_key";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "emailId",
DROP COLUMN "sourcePath",
ADD COLUMN     "messageId" UUID,
ADD COLUMN     "originalPath" TEXT;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
