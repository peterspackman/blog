/**
 * LAMMPS WebAssembly Worker
 * A clean, modern worker for running LAMMPS simulations with proper VFS file management
 */

// Worker state
let lammpsModule = null;
let isInitialized = false;
let isInitializing = false;
let isRunning = false;

// Constants
const SIMULATION_DIR = '/sim';
const DEFAULT_INPUT_FILE = 'input.lmp';

// Set up Module configuration before importing the script
self.Module = {
    print: (text) => postMessage({ type: 'stdout', data: text }),
    printErr: (text) => postMessage({ type: 'stderr', data: text }),
    locateFile: (path, scriptDirectory) => {
        // Ensure WASM file is loaded from the correct location
        if (path === 'lmp.wasm') {
            return new URL('@peterspackman/lmpjs/dist/lmp.wasm', import.meta.url).href;
        }
        return scriptDirectory + path;
    },
    onRuntimeInitialized: () => {
        postMessage({
            type: 'stdout',
            data: 'LAMMPS runtime initialized'
        });
        
        lammpsModule = self.Module;
        initializeFileSystem();
    },
    onAbort: (what) => {
        isInitializing = false;
        postMessage({
            type: 'error',
            data: `LAMMPS WebAssembly aborted: ${what}`
        });
    },
    // Memory configuration
    INITIAL_MEMORY: 256 * 1024 * 1024, // 256MB
    MAXIMUM_MEMORY: 2 * 1024 * 1024 * 1024, // 2GB
    ALLOW_MEMORY_GROWTH: true,
    NO_EXIT_RUNTIME: true,
    FORCE_FILESYSTEM: true
};

/**
 * Initialize the LAMMPS WebAssembly module by importing the script
 */
async function initializeLAMMPS() {
    if (isInitialized || isInitializing) {
        return;
    }
    
    isInitializing = true;
    
    try {
        postMessage({
            type: 'stdout',
            data: 'Loading LAMMPS WebAssembly script...'
        });
        
        // Import the LAMMPS script - this will use our pre-configured Module
        importScripts(new URL('@peterspackman/lmpjs/dist/lmp.js', import.meta.url).href);
        
        postMessage({
            type: 'stdout',
            data: 'LAMMPS script loaded, waiting for runtime initialization...'
        });
        
    } catch (error) {
        isInitializing = false;
        postMessage({
            type: 'error',
            data: `Failed to load LAMMPS script: ${error.message}`
        });
    }
}

/**
 * Initialize the virtual file system
 */
function initializeFileSystem() {
    try {
        // Create simulation directory if it doesn't exist
        if (!directoryExists(SIMULATION_DIR)) {
            lammpsModule.FS.mkdir(SIMULATION_DIR);
        }
        
        isInitialized = true;
        isInitializing = false;
        
        postMessage({
            type: 'stdout',
            data: `Simulation directory '${SIMULATION_DIR}' ready`
        });
        
        postMessage({
            type: 'ready',
            data: 'LAMMPS worker ready'
        });
        
    } catch (error) {
        isInitializing = false;
        postMessage({
            type: 'error',
            data: `Failed to initialize file system: ${error.message}`
        });
    }
}

/**
 * Utility functions for VFS operations
 */
function directoryExists(path) {
    try {
        const stat = lammpsModule.FS.stat(path);
        // Check if it's a directory using the mode flags (Emscripten style)
        return (stat.mode & 0o170000) === 0o040000;
    } catch {
        return false;
    }
}

function fileExists(path) {
    try {
        lammpsModule.FS.stat(path);
        return true;
    } catch {
        return false;
    }
}

function getFullPath(filename) {
    return `${SIMULATION_DIR}/${filename}`;
}

function validateWorkerReady() {
    if (!isInitialized || !lammpsModule) {
        throw new Error('LAMMPS worker not initialized');
    }
}

/**
 * Message handlers
 */
const messageHandlers = {
    'upload-file': handleFileUpload,
    'upload-files': handleMultipleFileUpload,
    'run-lammps': runLAMMPS,
    'delete-file': deleteFile,
    'delete-files': deleteMultipleFiles,
    'get-file': getFile,
    'list-files': listFiles,
    'clear-files': clearAllFiles,
    'get-file-info': getFileInfo,
    'poll-trajectory': pollTrajectoryFiles,
    'get-trajectory': getTrajectoryContent
};

/**
 * Handle incoming messages from the main thread
 */
self.onmessage = async function(e) {
    const { type, data, id } = e.data;
    
    try {
        if (type === 'init') {
            await initializeLAMMPS();
            return;
        }
        
        const handler = messageHandlers[type];
        if (handler) {
            await handler(data, id);
        } else {
            throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        postMessage({
            type: 'error',
            data: error.message,
            id
        });
    }
};

/**
 * Upload a single file to the VFS
 */
async function handleFileUpload(fileData, id) {
    validateWorkerReady();
    
    const { name, content } = fileData;
    const fullPath = getFullPath(name);
    
    try {
        // Convert content to Uint8Array if needed
        const fileContent = content instanceof Uint8Array ? content : new Uint8Array(content);
        
        lammpsModule.FS.writeFile(fullPath, fileContent);
        
        postMessage({
            type: 'file-uploaded',
            data: {
                filename: name,
                size: fileContent.length,
                path: fullPath
            },
            id
        });
        
    } catch (error) {
        throw new Error(`Failed to upload ${name}: ${error.message}`);
    }
}

/**
 * Upload multiple files to the VFS
 */
async function handleMultipleFileUpload(filesData, id) {
    validateWorkerReady();
    
    const results = [];
    
    for (const fileData of filesData) {
        try {
            const { name, content } = fileData;
            const fullPath = getFullPath(name);
            const fileContent = content instanceof Uint8Array ? content : new Uint8Array(content);
            
            lammpsModule.FS.writeFile(fullPath, fileContent);
            
            results.push({
                filename: name,
                size: fileContent.length,
                path: fullPath,
                status: 'uploaded'
            });
            
        } catch (error) {
            results.push({
                filename: fileData.name,
                status: 'error',
                error: error.message
            });
        }
    }
    
    postMessage({
        type: 'files-uploaded',
        data: results,
        id
    });
}

/**
 * Run LAMMPS simulation
 */
async function runLAMMPS(runData, id) {
    validateWorkerReady();
    
    if (isRunning) {
        throw new Error('LAMMPS simulation already running. Cancel current run first.');
    }
    
    const { inputContent, inputFile } = runData;
    let actualInputFile = inputFile;
    
    try {
        isRunning = true;
        
        postMessage({
            type: 'stdout',
            data: '=== Starting LAMMPS Simulation ==='
        });
        
        // Write input content if provided
        if (inputContent) {
            actualInputFile = actualInputFile || DEFAULT_INPUT_FILE;
            const fullPath = getFullPath(actualInputFile);
            lammpsModule.FS.writeFile(fullPath, inputContent);
            
            postMessage({
                type: 'stdout',
                data: `Input script written to ${actualInputFile}`
            });
        }
        
        if (!actualInputFile) {
            throw new Error('No input file specified and no input content provided');
        }
        
        // Verify input file exists
        const inputPath = getFullPath(actualInputFile);
        if (!fileExists(inputPath)) {
            throw new Error(`Input file ${actualInputFile} not found in simulation directory`);
        }
        
        // Change to simulation directory
        lammpsModule.FS.chdir(SIMULATION_DIR);
        
        postMessage({
            type: 'stdout',
            data: `> lmp -in ${actualInputFile}`
        });
        
        // Run LAMMPS with proper error handling
        const args = ['-in', actualInputFile];
        const exitCode = lammpsModule.callMain ? lammpsModule.callMain(args) : 0;
        
        isRunning = false;
        
        postMessage({
            type: 'completed',
            data: {
                exitCode,
                message: `Simulation completed with exit code: ${exitCode}`,
                inputFile: actualInputFile
            },
            id
        });
        
    } catch (error) {
        isRunning = false;
        throw new Error(`LAMMPS execution failed: ${error.message}`);
    }
}


/**
 * Delete a file from the VFS
 */
async function deleteFile(data, id) {
    validateWorkerReady();
    
    const { filename } = data;
    const fullPath = getFullPath(filename);
    
    try {
        if (fileExists(fullPath)) {
            lammpsModule.FS.unlink(fullPath);
            
            postMessage({
                type: 'file-deleted',
                data: {
                    filename,
                    path: fullPath
                },
                id
            });
        } else {
            postMessage({
                type: 'file-not-found',
                data: {
                    filename,
                    message: `File ${filename} not found`
                },
                id
            });
        }
    } catch (error) {
        throw new Error(`Failed to delete ${filename}: ${error.message}`);
    }
}

/**
 * Delete multiple files from the VFS
 */
async function deleteMultipleFiles(data, id) {
    validateWorkerReady();
    
    const { filenames } = data;
    const results = [];
    
    for (const filename of filenames) {
        try {
            const fullPath = getFullPath(filename);
            if (fileExists(fullPath)) {
                lammpsModule.FS.unlink(fullPath);
                results.push({ filename, status: 'deleted' });
            } else {
                results.push({ filename, status: 'not-found' });
            }
        } catch (error) {
            results.push({ filename, status: 'error', error: error.message });
        }
    }
    
    postMessage({
        type: 'files-deleted',
        data: results,
        id
    });
}

/**
 * Get file content from the VFS
 */
async function getFile(data, id) {
    validateWorkerReady();
    
    const { filename } = data;
    const fullPath = getFullPath(filename);
    
    try {
        if (!fileExists(fullPath)) {
            throw new Error(`File ${filename} not found`);
        }
        
        const fileContent = lammpsModule.FS.readFile(fullPath);
        
        postMessage({
            type: 'file-content',
            data: {
                filename,
                content: fileContent,
                size: fileContent.length
            },
            id
        });
        
    } catch (error) {
        throw new Error(`Failed to read ${filename}: ${error.message}`);
    }
}

/**
 * List all files in the simulation directory
 */
async function listFiles(data, id) {
    validateWorkerReady();
    
    try {
        const files = lammpsModule.FS.readdir(SIMULATION_DIR)
            .filter(name => name !== '.' && name !== '..')
            .map(name => {
                const fullPath = getFullPath(name);
                const stat = lammpsModule.FS.stat(fullPath);
                // Check if it's a directory using the mode flags (Emscripten style)
                const isDirectory = (stat.mode & 0o170000) === 0o040000;
                return {
                    name,
                    size: stat.size,
                    isDirectory,
                    path: fullPath
                };
            });
        
        postMessage({
            type: 'file-list',
            data: files,
            id
        });
        
    } catch (error) {
        throw new Error(`Failed to list files: ${error.message}`);
    }
}

/**
 * Clear all files from the simulation directory
 */
async function clearAllFiles(data, id) {
    validateWorkerReady();
    
    try {
        const files = lammpsModule.FS.readdir(SIMULATION_DIR)
            .filter(name => name !== '.' && name !== '..');
        
        let deletedCount = 0;
        const errors = [];
        
        for (const filename of files) {
            try {
                const fullPath = getFullPath(filename);
                lammpsModule.FS.unlink(fullPath);
                deletedCount++;
            } catch (error) {
                errors.push({ filename, error: error.message });
            }
        }
        
        postMessage({
            type: 'files-cleared',
            data: {
                deletedCount,
                errors,
                message: `Cleared ${deletedCount} files from simulation directory`
            },
            id
        });
        
    } catch (error) {
        throw new Error(`Failed to clear files: ${error.message}`);
    }
}

/**
 * Get file information without reading content
 */
async function getFileInfo(data, id) {
    validateWorkerReady();
    
    const { filename } = data;
    const fullPath = getFullPath(filename);
    
    try {
        if (!fileExists(fullPath)) {
            throw new Error(`File ${filename} not found`);
        }
        
        const stat = lammpsModule.FS.stat(fullPath);
        
        postMessage({
            type: 'file-info',
            data: {
                filename,
                size: stat.size,
                isDirectory: stat.isDirectory(),
                path: fullPath
            },
            id
        });
        
    } catch (error) {
        throw new Error(`Failed to get info for ${filename}: ${error.message}`);
    }
}

/**
 * Poll for trajectory files in the simulation directory
 */
async function pollTrajectoryFiles(data, id) {
    validateWorkerReady();

    const trajectoryPatterns = [
        /trajectory\.xyz$/i,
        /\.xyz$/i,
        /\.dcd$/i,
        /\.lammpstrj$/i
    ];

    try {
        const files = lammpsModule.FS.readdir(SIMULATION_DIR)
            .filter(name => name !== '.' && name !== '..');

        const trajectoryFiles = [];

        for (const filename of files) {
            const isTrajectory = trajectoryPatterns.some(pattern => pattern.test(filename));

            if (isTrajectory) {
                const fullPath = getFullPath(filename);
                try {
                    const stat = lammpsModule.FS.stat(fullPath);
                    // Determine format
                    let format = 'xyz';
                    if (/\.dcd$/i.test(filename)) format = 'dcd';
                    else if (/\.lammpstrj$/i.test(filename)) format = 'lammpstrj';

                    trajectoryFiles.push({
                        filename,
                        size: stat.size,
                        path: fullPath,
                        format
                    });
                } catch (statError) {
                    // Skip files that can't be stat'd
                }
            }
        }

        postMessage({
            type: 'trajectory-files',
            data: trajectoryFiles,
            id
        });

    } catch (error) {
        // Don't throw error for polling - just return empty
        postMessage({
            type: 'trajectory-files',
            data: [],
            id
        });
    }
}

/**
 * Get trajectory file content
 */
async function getTrajectoryContent(data, id) {
    validateWorkerReady();

    const { filename } = data;
    const fullPath = getFullPath(filename);

    try {
        if (!fileExists(fullPath)) {
            postMessage({
                type: 'trajectory-content',
                data: {
                    filename,
                    content: new Uint8Array(0),
                    size: 0
                },
                id
            });
            return;
        }

        const fileContent = lammpsModule.FS.readFile(fullPath);

        postMessage({
            type: 'trajectory-content',
            data: {
                filename,
                content: fileContent,
                size: fileContent.length
            },
            id
        });

    } catch (error) {
        postMessage({
            type: 'trajectory-content',
            data: {
                filename,
                content: new Uint8Array(0),
                size: 0,
                error: error.message
            },
            id
        });
    }
}

// Initialize the worker on load
initializeLAMMPS().catch(error => {
    postMessage({
        type: 'error',
        data: `Worker initialization failed: ${error.message}`
    });
});