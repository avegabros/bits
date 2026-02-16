import { prisma } from './src/lib/prisma';

async function cleanupNotes() {
    console.log('--- Cleaning up attendance notes ---');
    try {
        const records = await prisma.attendance.findMany({
            where: {
                notes: {
                    contains: '[Startup Repair]'
                }
            }
        });

        console.log(`Found ${records.length} records to clean up.`);

        for (const record of records) {
            if (record.notes) {
                const newNote = record.notes.replace('[Startup Repair] ', '');
                await prisma.attendance.update({
                    where: { id: record.id },
                    data: { notes: newNote }
                });
            }
        }

        console.log('--- Cleanup finished ---');
    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupNotes();
