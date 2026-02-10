const { syncZkData } = require('./dist/services/zkServices');

async function manualSync() {
    console.log('Starting manual sync...');
    try {
        const result = await syncZkData();
        console.log('Sync result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Sync error:', error);
    }
}

manualSync();
