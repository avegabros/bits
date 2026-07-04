-- AlterTable
ALTER TABLE "SyncConfig" ADD COLUMN     "dbBackupCompress" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dbBackupCron" TEXT NOT NULL DEFAULT '0 0 * * *',
ADD COLUMN     "dbBackupEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dbBackupRetention" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "lastBackupAt" TIMESTAMP(3),
ADD COLUMN     "lastBackupError" TEXT,
ADD COLUMN     "lastBackupStatus" TEXT;
