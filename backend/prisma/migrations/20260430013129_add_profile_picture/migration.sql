-- DropForeignKey
ALTER TABLE "AttendanceAdjustment" DROP CONSTRAINT "AttendanceAdjustment_attendanceId_fkey";

-- AlterTable
ALTER TABLE "AttendanceAdjustment" ADD COLUMN     "employeeBranch" TEXT,
ADD COLUMN     "employeeName" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'UPDATE',
ALTER COLUMN "attendanceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "profilePicture" TEXT;

-- AddForeignKey
ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT "AttendanceAdjustment_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
