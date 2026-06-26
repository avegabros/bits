-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "checkInAuthMethod" TEXT,
ADD COLUMN     "checkOutAuthMethod" TEXT;

-- AlterTable
ALTER TABLE "AttendanceLog" ADD COLUMN     "authMethod" TEXT;
