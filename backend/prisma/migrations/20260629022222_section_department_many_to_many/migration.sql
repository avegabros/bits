-- CreateTable
CREATE TABLE "SectionDepartment" (
    "sectionId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionDepartment_pkey" PRIMARY KEY ("sectionId","departmentId")
);

-- Copy existing relationships from Section to SectionDepartment join table
INSERT INTO "SectionDepartment" ("sectionId", "departmentId")
SELECT "id", "departmentId" FROM "Section"
WHERE "departmentId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Section" DROP CONSTRAINT "Section_departmentId_fkey";

-- DropIndex
DROP INDEX "Section_name_departmentId_key";

-- DropIndex
DROP INDEX "Section_departmentId_idx";

-- AlterTable
ALTER TABLE "Section" DROP COLUMN "departmentId";

-- CreateIndex
CREATE UNIQUE INDEX "Section_name_key" ON "Section"("name");

-- AddForeignKey
ALTER TABLE "SectionDepartment" ADD CONSTRAINT "SectionDepartment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionDepartment" ADD CONSTRAINT "SectionDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "SectionDepartment_sectionId_idx" ON "SectionDepartment"("sectionId");

-- CreateIndex
CREATE INDEX "SectionDepartment_departmentId_idx" ON "SectionDepartment"("departmentId");
