// Web Worker for elastic tensor calculations
// This worker handles the computationally intensive calculations off the main thread

let OCC = null;
let occModule = null;

// Initialize OCC module when worker starts
self.addEventListener('message', async function(e) {
    const { type, data } = e.data;
    
    try {
        switch(type) {
            case 'init':
                await initializeOCC(data);
                break;
                
            case 'analyzeTensor':
                await analyzeTensor(data);
                break;
                
            case 'generateDirectionalData':
                await generateDirectionalData(data);
                break;
                
            case 'generate3DSurfaceData':
                await generate3DSurfaceData(data);
                break;
                
            default:
                postMessage({ type: 'error', error: `Unknown message type: ${type}` });
        }
    } catch (error) {
        postMessage({ 
            type: 'error', 
            error: error.message || 'Unknown error occurred',
            stack: error.stack 
        });
    }
});

async function initializeOCC(config) {
    try {
        postMessage({ type: 'log', level: 2, message: 'Initializing OCC in worker...' });
        
        // Import the OCC module
        try {
            // Import main package - exports field will resolve to browser version
            OCC = await import('@peterspackman/occjs');
            postMessage({ type: 'log', level: 2, message: 'Loaded OCC package' });
        } catch (e) {
            postMessage({ 
                type: 'initialized', 
                success: false, 
                error: `OCC package import failed: ${e.message}. The WASM module contains Node.js-specific imports that don't work in browsers.` 
            });
            return;
        }
        
        // Load the WASM module
        occModule = await OCC.loadOCC();
        
        // Set up logging callback to forward logs to main thread
        if (occModule.registerLogCallback) {
            occModule.registerLogCallback((level, message) => {
                postMessage({ 
                    type: 'log', 
                    level: level, 
                    message: message 
                });
            });
        }
        
        postMessage({ type: 'initialized', success: true });
        
    } catch (error) {
        postMessage({ 
            type: 'initialized', 
            success: false, 
            error: error.message 
        });
    }
}

async function analyzeTensor(params) {
    try {
        postMessage({ type: 'log', level: 2, message: 'Starting elastic tensor analysis...' });
        
        const { tensorData } = params;
        
        // Create 6x6 matrix from the input
        let mat6;
        if (occModule.Mat6 && occModule.Mat6.create) {
            mat6 = occModule.Mat6.create(6, 6);
        } else {
            mat6 = occModule.Mat.create(6, 6);
        }
        
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 6; j++) {
                mat6.set(i, j, tensorData[i][j]);
            }
        }
        
        // Create ElasticTensor
        const elasticTensor = new occModule.ElasticTensor(mat6);
        
        // Calculate average properties
        const schemes = [occModule.AveragingScheme.VOIGT, occModule.AveragingScheme.REUSS, occModule.AveragingScheme.HILL];
        const schemeNames = ['voigt', 'reuss', 'hill'];
        
        const properties = {
            bulkModulus: {},
            shearModulus: {},
            youngsModulus: {},
            poissonRatio: {},
            linearCompressibility: {}
        };
        
        for (let i = 0; i < schemes.length; i++) {
            const scheme = schemes[i];
            const name = schemeNames[i];
            
            properties.bulkModulus[name] = elasticTensor.averageBulkModulus(scheme);
            properties.shearModulus[name] = elasticTensor.averageShearModulus(scheme);
            properties.youngsModulus[name] = elasticTensor.averageYoungsModulus(scheme);
            properties.poissonRatio[name] = elasticTensor.averagePoissonRatio(scheme);
            
            // Calculate linear compressibility average as 1/bulk modulus
            properties.linearCompressibility[name] = 1000 / properties.bulkModulus[name]; // Convert to TPa^-1
        }
        
        // Calculate eigenvalues (diagonal elements as approximation)
        const eigenvalues = [];
        for (let i = 0; i < 6; i++) {
            eigenvalues.push(tensorData[i][i]);
        }
        eigenvalues.sort((a, b) => a - b);
        
        // Calculate directional extrema with more comprehensive sampling
        const numSamples = 50;
        const testDirections = [];
        
        // Generate more comprehensive directional sampling
        for (let i = 0; i < numSamples; i++) {
            for (let j = 0; j < numSamples; j++) {
                const theta = (i / numSamples) * Math.PI;
                const phi = (j / numSamples) * 2 * Math.PI;
                const x = Math.sin(theta) * Math.cos(phi);
                const y = Math.sin(theta) * Math.sin(phi);
                const z = Math.cos(theta);
                testDirections.push(occModule.Vec3.create(x, y, z));
            }
        }
        
        let youngsMin = Infinity, youngsMax = -Infinity;
        let compMin = Infinity, compMax = -Infinity;
        let shearMin = Infinity, shearMax = -Infinity;
        let poissonMin = Infinity, poissonMax = -Infinity;
        
        testDirections.forEach(dir => {
            try {
                const youngsValue = elasticTensor.youngsModulus(dir);
                youngsMin = Math.min(youngsMin, youngsValue);
                youngsMax = Math.max(youngsMax, youngsValue);
                
                const compValue = elasticTensor.linearCompressibility(dir);
                compMin = Math.min(compMin, compValue);
                compMax = Math.max(compMax, compValue);
                
                // Try to get shear and Poisson min/max if methods exist
                try {
                    const shearMinMax = elasticTensor.shearModulusMinMax(dir);
                    if (shearMinMax) {
                        shearMin = Math.min(shearMin, shearMinMax.min);
                        shearMax = Math.max(shearMax, shearMinMax.max);
                    }
                } catch (e) {
                    // Fallback: approximate with some fraction of Young's modulus
                    const approxShear = youngsValue / (2 * (1 + 0.3)); // Assuming Poisson ~0.3
                    shearMin = Math.min(shearMin, approxShear);
                    shearMax = Math.max(shearMax, approxShear);
                }
                
                try {
                    const poissonMinMax = elasticTensor.poissonRatioMinMax(dir);
                    if (poissonMinMax) {
                        poissonMin = Math.min(poissonMin, poissonMinMax.min);
                        poissonMax = Math.max(poissonMax, poissonMinMax.max);
                    }
                } catch (e) {
                    // Fallback: use relationship with Young's and shear modulus
                    const approxPoisson = (youngsValue / (2 * (youngsValue / 3))) - 1; // rough approximation
                    poissonMin = Math.min(poissonMin, Math.max(-1, approxPoisson));
                    poissonMax = Math.max(poissonMax, Math.min(0.5, approxPoisson));
                }
                
            } catch (e) {
                postMessage({ type: 'log', level: 1, message: `Warning: Could not calculate property for direction: ${e.message}` });
            }
        });
        
        const extrema = {
            shearModulus: { min: shearMin, max: shearMax, anisotropy: shearMax / shearMin },
            youngsModulus: { min: youngsMin, max: youngsMax, anisotropy: youngsMax / youngsMin },
            poissonRatio: { min: poissonMin, max: poissonMax, anisotropy: Math.abs(poissonMax / poissonMin) },
            linearCompressibility: { min: compMin, max: compMax, anisotropy: compMax / compMin }
        };
        
        postMessage({
            type: 'analysisResult',
            success: true,
            data: {
                properties,
                eigenvalues,
                extrema,
                elasticTensor: elasticTensor // Pass tensor for further calculations
            }
        });
        
        postMessage({ type: 'log', level: 2, message: 'Elastic tensor analysis complete' });
        
    } catch (error) {
        postMessage({
            type: 'analysisResult',
            success: false,
            error: error.message
        });
    }
}

async function generateDirectionalData(params) {
    try {
        const { tensorData, property, plane, numPoints } = params;
        
        postMessage({ type: 'log', level: 2, message: `Generating directional data for ${property}...` });
        
        // Create ElasticTensor (recreate since we can't serialize it)
        let mat6;
        if (occModule.Mat6 && occModule.Mat6.create) {
            mat6 = occModule.Mat6.create(6, 6);
        } else {
            mat6 = occModule.Mat.create(6, 6);
        }
        
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 6; j++) {
                mat6.set(i, j, tensorData[i][j]);
            }
        }
        
        const elasticTensor = new occModule.ElasticTensor(mat6);
        
        // Use built-in WASM method if available
        if (elasticTensor.generateDirectionalData) {
            try {
                const wasmResult = elasticTensor.generateDirectionalData(property, numPoints || 180);
                const data = [];
                
                // Convert WASM result to our format
                for (let i = 0; i < wasmResult.size(); i++) {
                    const point = wasmResult.get(i);
                    let x = point.x;
                    let y = point.y;
                    
                    // Transform coordinates based on plane
                    if (plane === 'xz') {
                        // For XZ plane: x stays x, y becomes z (swap y and z)
                        const temp = y;
                        y = 0; // Not used in XZ
                        // We'll plot x vs the original y (now representing z)
                        y = temp;
                    } else if (plane === 'yz') {
                        // For YZ plane: x becomes y, y becomes z
                        const temp = x;
                        x = y;
                        y = temp;
                    }
                    // xy plane uses x, y as-is
                    
                    data.push({
                        angle: point.angle * 180 / Math.PI,
                        angleRad: point.angle,
                        value: point.value,
                        valueMin: point.value, // WASM method gives single value
                        valueMax: point.value,
                        x: x,
                        y: y
                    });
                }
                
                postMessage({
                    type: 'directionalDataResult',
                    success: true,
                    data: data,
                    plane: plane
                });
                
                postMessage({ type: 'log', level: 2, message: 'Directional data generation complete (WASM)' });
                return;
            } catch (e) {
                postMessage({ type: 'log', level: 1, message: `WASM method failed, using fallback: ${e.message}` });
            }
        }
        
        // Fallback to original method
        const data = [];
        
        for (let i = 0; i <= numPoints; i++) {
            const theta = (i / numPoints) * 2 * Math.PI;
            
            let direction;
            if (plane === 'xy') {
                direction = occModule.Vec3.create(Math.cos(theta), Math.sin(theta), 0);
            } else if (plane === 'xz') {
                direction = occModule.Vec3.create(Math.cos(theta), 0, Math.sin(theta));
            } else {
                direction = occModule.Vec3.create(0, Math.cos(theta), Math.sin(theta));
            }
            
            let value = 0;
            let valueMin = 0;
            let valueMax = 0;
            
            try {
                if (property === 'youngs') {
                    value = elasticTensor.youngsModulus(direction);
                    valueMin = valueMax = value;
                } else if (property === 'linear_compressibility') {
                    value = elasticTensor.linearCompressibility(direction);
                    valueMin = valueMax = value;
                } else if (property === 'shear') {
                    const minMax = elasticTensor.shearModulusMinMax(direction);
                    valueMin = minMax.min;
                    valueMax = minMax.max;
                    value = valueMax;
                } else if (property === 'poisson') {
                    const minMax = elasticTensor.poissonRatioMinMax(direction);
                    valueMin = minMax.min;
                    valueMax = minMax.max;
                    value = valueMax;
                }
            } catch (e) {
                // Use fallback values
                value = valueMin = valueMax = 0;
            }
            
            data.push({
                angle: theta * 180 / Math.PI,
                angleRad: theta,
                value,
                valueMin,
                valueMax
            });
        }
        
        postMessage({
            type: 'directionalDataResult',
            success: true,
            data: data,
            plane: plane
        });
        
        postMessage({ type: 'log', level: 2, message: 'Directional data generation complete' });
        
    } catch (error) {
        postMessage({
            type: 'directionalDataResult',
            success: false,
            error: error.message
        });
    }
}

async function generate3DSurfaceData(params) {
    try {
        const { tensorData, property } = params;
        
        postMessage({ type: 'log', level: 2, message: `Generating 3D surface data for ${property}...` });
        
        // Create ElasticTensor (recreate since we can't serialize it)
        let mat6;
        if (occModule.Mat6 && occModule.Mat6.create) {
            mat6 = occModule.Mat6.create(6, 6);
        } else {
            mat6 = occModule.Mat.create(6, 6);
        }
        
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 6; j++) {
                mat6.set(i, j, tensorData[i][j]);
            }
        }
        
        const elasticTensor = new occModule.ElasticTensor(mat6);
        
        // Generate spherical surface data
        const numU = 120; // azimuthal angle steps (high resolution for scatter)
        const numV = 60; // polar angle steps (high resolution for scatter)
        const surfaceData = [];
        
        for (let i = 0; i <= numU; i++) {
            const row = [];
            for (let j = 0; j <= numV; j++) {
                const u = (i / numU) * 2 * Math.PI; // azimuthal angle (0 to 2π)
                const v = (j / numV) * Math.PI;     // polar angle (0 to π)
                
                // Convert spherical to Cartesian for direction vector
                const x = Math.sin(v) * Math.cos(u);
                const y = Math.sin(v) * Math.sin(u);
                const z = Math.cos(v);
                
                const direction = occModule.Vec3.create(x, y, z);
                
                let value = 0;
                try {
                    if (property === 'youngs') {
                        value = elasticTensor.youngsModulus(direction);
                    } else if (property === 'linear_compressibility') {
                        value = elasticTensor.linearCompressibility(direction);
                    } else if (property === 'shear') {
                        // For shear, use maximum value
                        const minMax = elasticTensor.shearModulusMinMax(direction);
                        value = minMax ? minMax.max : 0;
                    } else if (property === 'poisson') {
                        // For Poisson, use maximum value
                        const minMax = elasticTensor.poissonRatioMinMax(direction);
                        value = minMax ? minMax.max : 0;
                    }
                } catch (e) {
                    value = 0;
                }
                
                row.push(value);
            }
            surfaceData.push(row);
        }
        
        // Find min/max for normalization
        const flatData = surfaceData.flat();
        const minValue = Math.min(...flatData);
        const maxValue = Math.max(...flatData);
        
        postMessage({
            type: '3DSurfaceResult',
            success: true,
            data: {
                surfaceData,
                minValue,
                maxValue,
                property,
                numU: numU + 1,
                numV: numV + 1
            }
        });
        
        postMessage({ type: 'log', level: 2, message: '3D surface data generation complete' });
        
    } catch (error) {
        postMessage({
            type: '3DSurfaceResult',
            success: false,
            error: error.message
        });
    }
}