-- DropIndex
DROP INDEX IF EXISTS "Branch_companyId_idx";

-- AlterTable: drop companyId from Branch
ALTER TABLE "Branch" DROP COLUMN IF EXISTS "companyId";

-- CreateTable: CompanyBranch join table
CREATE TABLE "CompanyBranch" (
    "companyId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,

    CONSTRAINT "CompanyBranch_pkey" PRIMARY KEY ("companyId","branchId")
);

-- AddForeignKey
ALTER TABLE "CompanyBranch" ADD CONSTRAINT "CompanyBranch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyBranch" ADD CONSTRAINT "CompanyBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
