import cron, { ScheduledTask } from 'node-cron';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as crypto from 'crypto';
import { URL } from 'url';
import { prisma } from '../../shared/lib/prisma';
import { audit } from '../../shared/lib/auditLogger';

/** Returns a formatted timestamp string for console logging (e.g. "11:15:30") */
function ts(): string {
    return new Date().toLocaleTimeString('en-US', {
        timeZone: 'Asia/Manila',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    });
}

export class BackupScheduler {
    private cronTask: ScheduledTask | null = null;
    private running: boolean = false;
    private enabled: boolean = false;
    private cronExpression: string = '0 0 * * *';
    private retention: number = 7;
    private compress: boolean = true;
    private lastRunAt: Date | null = null;

    /** Start the scheduler. Loads the current config from the DB. */
    public async start(): Promise<void> {
        if (this.running) return;
        this.running = true;
        console.log(`[${ts()}] [BackupScheduler] Starting database backup scheduler...`);
        await this.reloadConfigAndReset();
    }

    public stop(): void {
        this.running = false;
        this.stopCronTask();
        console.log(`[${ts()}] [BackupScheduler] Stopped.`);
    }

    /** Reloads config from DB and schedules the cron task if enabled. */
    public async reloadConfigAndReset(): Promise<void> {
        this.stopCronTask();

        if (!this.running) return;

        try {
            const config = await prisma.syncConfig.findUnique({ where: { id: 1 } });
            if (config) {
                this.enabled = config.dbBackupEnabled;
                this.cronExpression = config.dbBackupCron || '0 0 * * *';
                this.retention = config.dbBackupRetention ?? 7;
                this.compress = config.dbBackupCompress ?? true;
                this.lastRunAt = config.lastBackupAt;
            }
        } catch (err) {
            console.error(`[${ts()}] [BackupScheduler] Error reading config:`, err);
        }

        if (!this.enabled) {
            console.log(`[${ts()}] [BackupScheduler] Automatic backups disabled — no cron task scheduled.`);
            return;
        }

        if (!cron.validate(this.cronExpression)) {
            console.error(`[${ts()}] [BackupScheduler] Invalid cron expression: "${this.cronExpression}". Falling back to daily midnight.`);
            this.cronExpression = '0 0 * * *';
        }

        console.log(
            `[${ts()}] [BackupScheduler] Scheduled backup job with expression: "${this.cronExpression}" ` +
            `(retention: ${this.retention}, compression: ${this.compress ? 'GZIP' : 'None'})`
        );

        this.cronTask = cron.schedule(this.cronExpression, () => {
            this.runBackup().catch(err =>
                console.error(`[${ts()}] [BackupScheduler] Unexpected error during scheduled backup:`, err)
            );
        }, { timezone: 'Asia/Manila' });
    }

    /** Triggers a backup immediately and updates status fields in DB. */
    public async triggerNow(performedBy?: number): Promise<{ success: boolean; message: string; filename?: string }> {
        console.log(`[${ts()}] [BackupScheduler] Manual backup triggered...`);
        try {
            const filename = await this.runBackup(performedBy);
            return { success: true, message: 'Database backup completed successfully', filename };
        } catch (err: any) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            console.error(`[${ts()}] [BackupScheduler] Manual backup failed:`, err);
            return { success: false, message: `Backup failed: ${errMsg}` };
        }
    }

    /**
     * Executes the actual pg_dump backup and performs directory cleanup based on retention policy.
     */
    private async runBackup(performedBy?: number): Promise<string> {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            throw new Error('DATABASE_URL environment variable is missing.');
        }

        const backupDir = path.resolve(process.cwd(), process.env.BACKUP_PATH || 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // Parse Database URL
        const parsedUrl = new URL(dbUrl);
        const username = parsedUrl.username;
        const password = decodeURIComponent(parsedUrl.password);
        const hostname = parsedUrl.hostname;
        const port = parsedUrl.port || '5432';
        const databaseName = parsedUrl.pathname.substring(1);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = this.compress ? '.sql.gz.enc' : '.sql.enc';
        const filename = `backup_${timestamp}${extension}`;
        const outputPath = path.join(backupDir, filename);

        console.log(`[${ts()}] [BackupScheduler] Exporting encrypted database to ${outputPath}...`);

        const args = [
            '-h', hostname,
            '-p', port,
            '-U', username,
            '-F', 'p', // Plain SQL text format, suitable for piping to gzip
            databaseName
        ];

        // Derive 32-byte key from BACKUP_ENCRYPTION_KEY env variable
        const rawKey = process.env.BACKUP_ENCRYPTION_KEY;
        const key = crypto.createHash('sha256').update(rawKey || 'default-fallback-key').digest();

        try {
            await new Promise<void>((resolve, reject) => {
                const pgDump = spawn('pg_dump', args, {
                    env: {
                        ...process.env,
                        PGPASSWORD: password
                    }
                });

                const writeStream = fs.createWriteStream(outputPath);

                // Generate a random 16-byte IV (Initialization Vector)
                const iv = crypto.randomBytes(16);
                
                // Write IV as the first 16 bytes of the file
                writeStream.write(iv);

                // Create the AES-256-CBC cipher stream
                const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

                if (this.compress) {
                    const gzip = zlib.createGzip();
                    pgDump.stdout.pipe(gzip).pipe(cipher).pipe(writeStream);
                } else {
                    pgDump.stdout.pipe(cipher).pipe(writeStream);
                }

                let stderrData = '';
                pgDump.stderr.on('data', (chunk) => {
                    stderrData += chunk.toString();
                });

                pgDump.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(stderrData.trim() || `pg_dump exited with code ${code}`));
                    } else {
                        resolve();
                    }
                });

                pgDump.on('error', (err) => {
                    reject(err);
                });
            });

            const backupTime = new Date();
            this.lastRunAt = backupTime;

            // Update SyncConfig status
            await prisma.syncConfig.update({
                where: { id: 1 },
                data: {
                    lastBackupAt: backupTime,
                    lastBackupStatus: 'success',
                    lastBackupError: null
                }
            });

            console.log(`[${ts()}] [BackupScheduler] Backup created successfully: ${filename}`);

            // Audit log
            void audit({
                action: 'EXPORT',
                entityType: 'System',
                performedBy: performedBy,
                details: `Database backup created successfully: ${filename}`,
                level: 'INFO'
            });

            // Perform retention cleanup
            this.pruneOldBackups(backupDir);

            return filename;
        } catch (error: any) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            
            // Update SyncConfig status with error
            await prisma.syncConfig.update({
                where: { id: 1 },
                data: {
                    lastBackupStatus: 'failed',
                    lastBackupError: errMsg
                }
            }).catch(e => console.error(`[${ts()}] [BackupScheduler] Failed to save backup error status to DB:`, e));

            // Audit log
            void audit({
                action: 'EXPORT',
                entityType: 'System',
                performedBy: performedBy,
                details: `Database backup failed: ${errMsg}`,
                level: 'ERROR'
            });

            throw error;
        }
    }

    /** Prunes files exceeding the retention limit */
    private pruneOldBackups(backupDir: string): void {
        try {
            const files = fs.readdirSync(backupDir)
                .filter(f => f.startsWith('backup_') && (f.endsWith('.sql.gz.enc') || f.endsWith('.sql.enc') || f.endsWith('.sql.gz') || f.endsWith('.sql')))
                .sort(); // Lexicographical sorting works chronologically for ISO filenames

            if (files.length > this.retention) {
                const pruneCount = files.length - this.retention;
                const toDelete = files.slice(0, pruneCount);
                
                for (const file of toDelete) {
                    fs.unlinkSync(path.join(backupDir, file));
                    console.log(`[${ts()}] [BackupScheduler] Pruned old backup file: ${file}`);
                }
            }
        } catch (err) {
            console.error(`[${ts()}] [BackupScheduler] Error during pruning:`, err);
        }
    }

    private stopCronTask(): void {
        if (this.cronTask) {
            this.cronTask.stop();
            this.cronTask = null;
        }
    }

    public getStatus() {
        return {
            enabled: this.enabled,
            cronExpression: this.cronExpression,
            retention: this.retention,
            compress: this.compress,
            lastRunAt: this.lastRunAt,
        };
    }
}

export const backupScheduler = new BackupScheduler();
