// Minimal worker that just signals ready status
// All actual calculations are done via the CLI worker (occ-cli-worker.js)

self.addEventListener('message', function(e) {
    const { type } = e.data;

    switch(type) {
        case 'init':
            // Just signal that we're ready immediately
            self.postMessage({
                type: 'initialized',
                success: true
            });
            break;

        case 'warmup':
            // No warmup needed for CLI-based approach
            self.postMessage({
                type: 'log',
                level: 2,
                message: 'Using CLI-based calculation (no warmup needed)'
            });
            break;

        default:
            self.postMessage({
                type: 'error',
                error: `Unknown message type: ${type}. All calculations now use the CLI worker.`
            });
    }
});
