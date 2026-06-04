/*
  Warnings:

  - You are about to alter the column `shiftCode` on the `Shift` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(7)`.
  - You are about to alter the column `name` on the `Shift` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(32)`.
  - A unique constraint covering the columns `[employeeId,date,shiftId]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "EmploymentStatus" ADD VALUE 'STAGED';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MANAGER';

-- DropIndex
DROP INDEX "Attendance_employeeId_date_key";

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "gracePeriodApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isAnomaly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isEarlyOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lateMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "overtimeMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "shiftId" INTEGER,
ADD COLUMN     "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "undertimeMinutes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "Shift" ALTER COLUMN "shiftCode" SET DATA TYPE VARCHAR(7),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(32);

-- AlterTable
ALTER TABLE "SyncConfig" ADD COLUMN     "minShiftGapMinutes" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "ManagerDepartment" (
    "id" SERIAL NOT NULL,
    "managerId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" INTEGER,

    CONSTRAINT "ManagerDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeShift" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceBiometricExclusion" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "excludedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excludedBy" INTEGER,
    "reason" TEXT,

    CONSTRAINT "DeviceBiometricExclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayBranch" (
    "holidayId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,

    CONSTRAINT "HolidayBranch_pkey" PRIMARY KEY ("holidayId","branchId")
);

-- CreateTable
CREATE TABLE "OvertimeRequest" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reviewedById" INTEGER,
    "rejectionReason" TEXT,
    "actualStartTime" TIMESTAMP(3),
    "actualEndTime" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagerDepartment_managerId_idx" ON "ManagerDepartment"("managerId");

-- CreateIndex
CREATE INDEX "ManagerDepartment_departmentId_idx" ON "ManagerDepartment"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerDepartment_managerId_departmentId_key" ON "ManagerDepartment"("managerId", "departmentId");

-- CreateIndex
CREATE INDEX "EmployeeShift_employeeId_idx" ON "EmployeeShift"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeShift_shiftId_idx" ON "EmployeeShift"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeShift_employeeId_shiftId_key" ON "EmployeeShift"("employeeId", "shiftId");

-- CreateIndex
CREATE INDEX "DeviceBiometricExclusion_employeeId_idx" ON "DeviceBiometricExclusion"("employeeId");

-- CreateIndex
CREATE INDEX "DeviceBiometricExclusion_deviceId_idx" ON "DeviceBiometricExclusion"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceBiometricExclusion_type_idx" ON "DeviceBiometricExclusion"("type");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceBiometricExclusion_employeeId_deviceId_type_key" ON "DeviceBiometricExclusion"("employeeId", "deviceId", "type");

-- CreateIndex
CREATE INDEX "HolidayBranch_branchId_idx" ON "HolidayBranch"("branchId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_employeeId_idx" ON "OvertimeRequest"("employeeId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_date_idx" ON "OvertimeRequest"("date");

-- CreateIndex
CREATE INDEX "OvertimeRequest_status_idx" ON "OvertimeRequest"("status");

-- CreateIndex
CREATE INDEX "Attendance_shiftId_idx" ON "Attendance"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_employeeId_date_shiftId_key" ON "Attendance"("employeeId", "date", "shiftId");

-- CreateIndex
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerDepartment" ADD CONSTRAINT "ManagerDepartment_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerDepartment" ADD CONSTRAINT "ManagerDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerDepartment" ADD CONSTRAINT "ManagerDepartment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeShift" ADD CONSTRAINT "EmployeeShift_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeShift" ADD CONSTRAINT "EmployeeShift_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceBiometricExclusion" ADD CONSTRAINT "DeviceBiometricExclusion_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceBiometricExclusion" ADD CONSTRAINT "DeviceBiometricExclusion_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayBranch" ADD CONSTRAINT "HolidayBranch_holidayId_fkey" FOREIGN KEY ("holidayId") REFERENCES "Holiday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayBranch" ADD CONSTRAINT "HolidayBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
