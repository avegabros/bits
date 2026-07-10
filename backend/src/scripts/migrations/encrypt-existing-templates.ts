/**
 * encrypt-existing-templates.ts
 * 
 * One-time migration script to encrypt all existing plaintext fingerprint
 * templates in the database using AES-256-GCM.
 * 
 * Usage:
 *   npx ts-node src/scripts/migrations/encrypt-existing-templates.ts
 */

import { prisma } from '../../shared/lib/prisma';
import { isEncrypted, encryptTemplate } from '../../shared/utils/biometric-crypto';
import dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables (to read BIOMETRIC_ENCRYPTION_KEY)
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

async function main() {
    console.log('='.repeat(70));
    console.log('  BIOMETRIC TEMPLATE ENCRYPTION MIGRATION');
    console.log('  Encrypts all existing plaintext database biometric templates.');
    console.log('='.repeat(70));
    console.log();

    // Verify key exists before proceeding
    const rawKey = process.env.BIOMETRIC_ENCRYPTION_KEY;
    if (!rawKey) {
        console.error('Error: BIOMETRIC_ENCRYPTION_KEY environment variable is not defined.');
        console.error('Please define it in your .env file before running this migration.');
        process.exit(1);
    }

    try {
        // Fetch all templates
        const templates = await prisma.fingerprintTemplate.findMany({
            include: {
                employee: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        console.log(`Found ${templates.length} total biometric template record(s) in the database.\n`);

        let alreadyEncryptedCount = 0;
        let successfullyEncryptedCount = 0;
        let failedCount = 0;

        for (const t of templates) {
            const rawBuffer = Buffer.from(t.templateData);
            const employeeName = `${t.employee?.firstName || ''} ${t.employee?.lastName || ''}`.trim() || `ID ${t.employeeId}`;

            if (isEncrypted(rawBuffer)) {
                alreadyEncryptedCount++;
                console.log(`[Skip] Template for employee "${employeeName}" (Finger Index ${t.fingerIndex}) is already encrypted.`);
                continue;
            }

            try {
                const encryptedBuffer = encryptTemplate(rawBuffer);

                await prisma.fingerprintTemplate.update({
                    where: { id: t.id },
                    data: {
                        templateData: encryptedBuffer as any,
                        updatedAt: new Date()
                    }
                });

                successfullyEncryptedCount++;
                console.log(`[Success] Encrypted template for employee "${employeeName}" (Finger Index ${t.fingerIndex}) successfully.`);
            } catch (err: any) {
                failedCount++;
                console.error(`[Error] Failed to encrypt template for employee "${employeeName}" (Finger Index ${t.fingerIndex}):`, err.message || err);
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log('  MIGRATION SUMMARY');
        console.log('='.repeat(70));
        console.log(`Total records processed:     ${templates.length}`);
        console.log(`Already encrypted (skipped):  ${alreadyEncryptedCount}`);
        console.log(`Successfully encrypted:       ${successfullyEncryptedCount}`);
        console.log(`Failed to encrypt:            ${failedCount}`);
        console.log('='.repeat(70));

    } catch (err: any) {
        console.error('\nFatal migration error:', err.message || err);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Test execution failed:', err);
});
