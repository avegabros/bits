-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "branchId" INTEGER;

-- CreateTable
CREATE TABLE "FingerprintTemplate" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "fingerIndex" INTEGER NOT NULL,
    "templateData" BYTEA NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FingerprintTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchAgent" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastConnectedAt" TIMESTAMP(3),
    "lastDisconnectedAt" TIMESTAMP(3),
    "agentVersion" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchAgent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FingerprintTemplate_employeeId_idx" ON "FingerprintTemplate"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "FingerprintTemplate_employeeId_fingerIndex_key" ON "FingerprintTemplate"("employeeId", "fingerIndex");

-- CreateIndex
CREATE UNIQUE INDEX "BranchAgent_branchId_key" ON "BranchAgent"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchAgent_tokenHash_key" ON "BranchAgent"("tokenHash");

-- CreateIndex
CREATE INDEX "BranchAgent_branchId_idx" ON "BranchAgent"("branchId");

-- CreateIndex
CREATE INDEX "BranchAgent_isEnabled_idx" ON "BranchAgent"("isEnabled");

-- CreateIndex
CREATE INDEX "Device_branchId_idx" ON "Device"("branchId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FingerprintTemplate" ADD CONSTRAINT "FingerprintTemplate_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchAgent" ADD CONSTRAINT "BranchAgent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
