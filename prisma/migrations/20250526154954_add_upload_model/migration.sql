-- CreateEnum
CREATE TYPE "UploadType" AS ENUM ('file', 'form', 'api');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "Upload" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "UploadType" NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'pending',
    "fileName" VARCHAR(255) NOT NULL,
    "path" VARCHAR(100) NOT NULL,
    "hash" VARCHAR(64) NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Upload_name_key" ON "Upload"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_path_key" ON "Upload"("path");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_hash_key" ON "Upload"("hash");

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
