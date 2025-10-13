// CLI worker for running OCC calculations
// Based on getocc's occ-run-worker.js pattern

let commandData = null;
let moduleReady = false;
let outputBuffer = '';

self.onmessage = async function(e) {
    commandData = e.data;

    if (moduleReady) {
        executeCommand();
    }
};

function executeCommand() {
    const {
        command,
        xyzData,
        owfData,
        method,
        basis,
        charge,
        threads,
        multiplicity,
        unrestricted,
        optMaxIterations,
        computeFrequencies,
        property,
        orbital,
        spin,
        gridSteps,
        adaptive,
        bufferDistance,
        threshold,
        origin,
        directionA,
        directionB,
        directionC
    } = commandData;

    try {
        let args = [];

        if (command === 'cube') {
            // Handle cube generation command
            const wfnFilename = '/input.owf.json';
            Module.FS.writeFile(wfnFilename, owfData);

            args = ['cube', 'input.owf.json'];

            // Add property (default to density)
            if (property) {
                args.push(property);
            } else {
                args.push('density');
            }

            // Add spin channel if provided (alpha, beta, or default to both)
            if (spin) {
                args.push(spin);
            }

            // Add orbital specification if provided
            if (orbital !== undefined && orbital !== null) {
                args.push('--orbital', orbital.toString());
            }

            // Add grid steps
            const steps = gridSteps || 40;
            args.push('-n', steps.toString(), steps.toString(), steps.toString());

            // Add adaptive bounds if enabled
            if (adaptive) {
                args.push('--adaptive');
                if (threshold !== undefined) {
                    args.push('--threshold', threshold.toString());
                }
                if (bufferDistance !== undefined) {
                    args.push('--buffer', bufferDistance.toString());
                }
            }

            // Add custom origin if provided
            if (origin && Array.isArray(origin) && origin.length === 3) {
                args.push('--origin', origin[0].toString(), origin[1].toString(), origin[2].toString());
            }

            // Add custom directions if provided
            if (directionA && Array.isArray(directionA) && directionA.length === 3) {
                args.push('--da', directionA[0].toString(), directionA[1].toString(), directionA[2].toString());
            }
            if (directionB && Array.isArray(directionB) && directionB.length === 3) {
                args.push('--db', directionB[0].toString(), directionB[1].toString(), directionB[2].toString());
            }
            if (directionC && Array.isArray(directionC) && directionC.length === 3) {
                args.push('--dc', directionC[0].toString(), directionC[1].toString(), directionC[2].toString());
            }

            // Specify output file
            args.push('-o', '/output.cube');

        } else {
            // Handle SCF calculation command (default)
            const inputFilename = '/input.xyz';
            Module.FS.writeFile(inputFilename, xyzData);

            args = ['scf', 'input.xyz'];

            // Add positional arguments
            if (method) args.push(method);
            if (basis) args.push(basis);

            // Add optional flags
            if (charge !== undefined && charge !== 0) {
                args.push('--charge', charge.toString());
            }
            if (multiplicity !== undefined && multiplicity !== 1) {
                args.push('--multiplicity', multiplicity.toString());
            }
            if (unrestricted) {
                args.push('--unrestricted');
            }

            // Add optimization driver flag
            if (optMaxIterations) {
                args.push('--driver=opt');
                args.push('--opt-max-iterations', optMaxIterations.toString());
            }

            // Add frequency calculation flag
            if (computeFrequencies) {
                args.push('--frequencies');
            }

            // Add threads argument
            if (threads !== undefined && threads > 0) {
                args.push(`--threads=${threads}`);
            }

            // Add output format arguments to generate both JSON and FCHK
            args.push('-o', 'json', '-o', 'fchk');
        }

        self.postMessage({ type: 'ready' });

        // Call main with arguments
        const exitCode = Module.callMain(args);

        // Collect output files from filesystem
        const outputFiles = {};
        function collectFiles(dir) {
            const contents = Module.FS.readdir(dir);
            for (const item of contents) {
                if (item === '.' || item === '..') continue;

                const fullPath = dir === '/' ? '/' + item : dir + '/' + item;
                try {
                    const stat = Module.FS.stat(fullPath);
                    if (Module.FS.isDir(stat.mode)) {
                        collectFiles(fullPath);
                    } else {
                        outputFiles[fullPath] = Module.FS.readFile(fullPath);
                    }
                } catch (e) {
                    // Skip files we can't read
                }
            }
        }
        collectFiles('/');

        // For cube commands, also include decoded cube data and grid info
        let cubeData = null;
        let gridInfo = null;
        if (command === 'cube' && outputFiles['/output.cube']) {
            cubeData = new TextDecoder().decode(outputFiles['/output.cube']);

            // Parse cube file header to extract grid information
            try {
                const lines = cubeData.split('\n');
                if (lines.length >= 6) {
                    // Line 2: number of atoms and origin
                    const atomsLine = lines[2].trim().split(/\s+/);
                    const nAtoms = parseInt(atomsLine[0]);
                    const origin = [parseFloat(atomsLine[1]), parseFloat(atomsLine[2]), parseFloat(atomsLine[3])];

                    // Lines 3-5: grid dimensions and vectors
                    const xLine = lines[3].trim().split(/\s+/);
                    const yLine = lines[4].trim().split(/\s+/);
                    const zLine = lines[5].trim().split(/\s+/);

                    const nx = parseInt(xLine[0]);
                    const ny = parseInt(yLine[0]);
                    const nz = parseInt(zLine[0]);

                    const vx = [parseFloat(xLine[1]), parseFloat(xLine[2]), parseFloat(xLine[3])];
                    const vy = [parseFloat(yLine[1]), parseFloat(yLine[2]), parseFloat(yLine[3])];
                    const vz = [parseFloat(zLine[1]), parseFloat(zLine[2]), parseFloat(zLine[3])];

                    // Create basis matrix (stored as flat array for easier transmission)
                    const basis = [
                        vx[0], vx[1], vx[2],
                        vy[0], vy[1], vy[2],
                        vz[0], vz[1], vz[2]
                    ];

                    gridInfo = {
                        origin: origin,
                        nx: nx,
                        ny: ny,
                        nz: nz,
                        steps: gridSteps || 40,
                        basis: basis
                    };
                }
            } catch (parseError) {
                // If parsing fails, just skip grid info
                console.error('Failed to parse cube grid info:', parseError);
            }
        }

        self.postMessage({
            type: 'exit',
            code: exitCode,
            files: outputFiles,
            stdout: outputBuffer,
            cubeData: cubeData,
            gridInfo: gridInfo,
            property: property,
            orbital: orbital,
            spin: spin
        });
    } catch (error) {
        if (error && error.name === 'ExitStatus') {
            // Still collect files even on non-zero exit
            const outputFiles = {};
            function collectFiles(dir) {
                try {
                    const contents = Module.FS.readdir(dir);
                    for (const item of contents) {
                        if (item === '.' || item === '..') continue;

                        const fullPath = dir === '/' ? '/' + item : dir + '/' + item;
                        try {
                            const stat = Module.FS.stat(fullPath);
                            if (Module.FS.isDir(stat.mode)) {
                                collectFiles(fullPath);
                            } else {
                                outputFiles[fullPath] = Module.FS.readFile(fullPath);
                            }
                        } catch (e) {}
                    }
                } catch (e) {}
            }
            collectFiles('/');

            self.postMessage({
                type: 'exit',
                code: error.status,
                files: outputFiles,
                stdout: outputBuffer
            });
        } else {
            self.postMessage({ type: 'error', text: `Runtime error: ${error.message}` });
            self.postMessage({ type: 'exit', code: 1, files: {}, stdout: outputBuffer });
        }
    }
}

// Set up Module configuration BEFORE loading
var Module = {
    print: (text) => {
        outputBuffer += text + '\n';
        self.postMessage({ type: 'output', text });
    },
    printErr: (text) => {
        outputBuffer += text + '\n';
        self.postMessage({ type: 'error', text });
    },
    onAbort: (msg) => {
        self.postMessage({ type: 'error', text: `Module aborted: ${msg}` });
        self.postMessage({ type: 'exit', code: 1, files: {}, stdout: outputBuffer });
    },
    onRuntimeInitialized: () => {
        moduleReady = true;
        if (commandData) {
            executeCommand();
        }
    },
    locateFile: (path) => {
        if (path.endsWith('.wasm') || path.endsWith('.data')) {
            const base = self.location.href.substring(0, self.location.href.lastIndexOf('/'));
            return base + '/wasm/' + path;
        }
        return path;
    },
    noInitialRun: true
};

// Load the OCC module
try {
    importScripts('wasm/occ.js');
} catch (error) {
    self.postMessage({ type: 'error', text: `Failed to load occ.js: ${error.message}` });
    self.postMessage({ type: 'exit', code: 1, files: {}, stdout: '' });
}
