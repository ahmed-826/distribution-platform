-- CreateEnum
CREATE TYPE "FicheStatus" AS ENUM ('valid', 'suspended', 'canceled');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('File', 'Message', 'Attachment');

-- CreateTable
CREATE TABLE "Source" (
    "id" UUID NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "description" TEXT,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fiche" (
    "id" UUID NOT NULL,
    "ref" VARCHAR(32) NOT NULL,
    "sourceId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "object" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdBy" TEXT,
    "dateDistribute" TIMESTAMP(3),
    "path" TEXT NOT NULL,
    "hash" VARCHAR(64) NOT NULL,
    "status" "FicheStatus" NOT NULL DEFAULT 'suspended',
    "dump" VARCHAR(50),
    "uploadId" UUID NOT NULL,

    CONSTRAINT "Fiche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "content" TEXT,
    "meta" JSONB,
    "fileName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sourcePath" TEXT,
    "dumpInfo" JSONB,
    "hash" VARCHAR(64) NOT NULL,
    "ficheId" UUID,
    "emailId" UUID,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_name_key" ON "Source"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Fiche_ref_key" ON "Fiche"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Fiche_path_key" ON "Fiche"("path");

-- CreateIndex
CREATE UNIQUE INDEX "Fiche_hash_key" ON "Fiche"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "Document_path_key" ON "Document"("path");

-- CreateIndex
CREATE UNIQUE INDEX "Document_sourcePath_key" ON "Document"("sourcePath");

-- CreateIndex
CREATE UNIQUE INDEX "Document_hash_key" ON "Document"("hash");

-- AddForeignKey
ALTER TABLE "Fiche" ADD CONSTRAINT "Fiche_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fiche" ADD CONSTRAINT "Fiche_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ficheId_fkey" FOREIGN KEY ("ficheId") REFERENCES "Fiche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
