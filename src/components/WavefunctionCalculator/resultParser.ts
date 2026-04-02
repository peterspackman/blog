/**
 * Pure-function result parsing for OCC CLI output.
 * No React dependencies — easily testable.
 */

import type {
    CalculationResult,
    MatrixData,
    Matrices,
    OrbitalEnergies,
    OrbitalOccupations,
    CalculationProperties,
    OptimizationResult,
    FrequencyResult,
    WavefunctionData,
} from './types';

const HA_TO_EV = 27.2114;

/** Logs collected during parsing (returned alongside results). */
export interface ParseLog {
    message: string;
    level: 'info' | 'warn' | 'error';
}

export interface ParsedResults {
    result: CalculationResult;
    owfData: Uint8Array | null;
    logs: ParseLog[];
}

// ── Top-level entry point ──────────────────────────────────────────────────

export function parseCalculationResults(
    files: Record<string, Uint8Array>,
    stdout: string,
): ParsedResults {
    const logs: ParseLog[] = [];
    const log = (message: string, level: ParseLog['level'] = 'info') => logs.push({ message, level });

    // Parse energy from stdout
    const energyMatch = stdout.match(/total\s+([-\d.]+)/);
    if (!energyMatch) {
        throw new Error('Could not parse energy from output');
    }
    const energy = parseFloat(energyMatch[1]);

    const convergedMatch = stdout.match(/converged after ([\d.]+) seconds/);
    const converged = convergedMatch !== null;
    const convergenceTime = convergedMatch ? parseFloat(convergedMatch[1]) * 1000 : 0;

    // Find the .owf.json file
    const owfPath = Object.keys(files).find(path => path.endsWith('.owf.json'));
    if (!owfPath) {
        throw new Error('No .owf.json file found in output');
    }

    const owfRawData = files[owfPath];
    log(`Found wavefunction file: ${owfPath} (${owfRawData.length} bytes)`);

    const owfText = new TextDecoder().decode(owfRawData);
    log('Parsing wavefunction JSON...');

    let owfJson: any;
    try {
        owfJson = JSON.parse(owfText);
        log(`Parsed owf.json keys: ${Object.keys(owfJson).join(', ')}`);
    } catch (parseError: any) {
        log(`Failed to parse owf.json: ${parseError.message}`, 'error');
        throw parseError;
    }

    const result: CalculationResult = {
        energy,
        energyInEV: energy * HA_TO_EV,
        elapsedMs: convergenceTime,
        converged,
    };

    // Extract orbital data
    const mo = owfJson['molecular orbitals'];
    log(`Molecular orbitals object: ${mo ? 'found' : 'missing'}`);
    if (mo) {
        log(`MO keys: ${Object.keys(mo).join(', ')}`);
    }

    const isUnrestricted = mo && mo['spinorbital kind'] === 'unrestricted';
    log(`Calculation type: ${isUnrestricted ? 'unrestricted' : 'restricted'}`);

    parseOrbitalData(result, mo, isUnrestricted, log);
    parseWavefunctionMetadata(result, owfJson, mo, owfText, log);
    parseMatrices(result, owfJson, mo, log);
    parseFCHK(result, files, log);
    parseOptimization(result, files, energy, converged, log);
    parseFrequencies(result, files, owfJson, log);

    return { result, owfData: owfRawData, logs };
}

// ── Orbital energies and occupations ───────────────────────────────────────

function parseOrbitalData(
    result: CalculationResult,
    mo: any,
    isUnrestricted: boolean,
    log: (msg: string, level?: ParseLog['level']) => void,
): void {
    if (!mo) return;

    // Parse orbital energies
    if (isUnrestricted) {
        const orbitalEnergies = mo['orbital energies'];
        if (orbitalEnergies && Array.isArray(orbitalEnergies)) {
            const halfPoint = orbitalEnergies.length / 2;
            const alphaEnergies = orbitalEnergies.slice(0, halfPoint).map((e: number) => Number(e));
            const betaEnergies = orbitalEnergies.slice(halfPoint).map((e: number) => Number(e));
            result.orbitalEnergies = { alpha: alphaEnergies, beta: betaEnergies, isUnrestricted: true };
            log(`Found ${alphaEnergies.length} alpha and ${betaEnergies.length} beta orbital energies`);
        } else {
            log('No orbital energies found for unrestricted calculation', 'warn');
        }
    } else {
        const orbitalEnergies = mo['orbital energies'];
        if (orbitalEnergies) {
            result.orbitalEnergies = orbitalEnergies;
            log(`Found ${orbitalEnergies.length} orbital energies`);
        } else {
            log('No energies found in MO object', 'warn');
        }
    }

    // Parse occupations and HOMO/LUMO
    const nAlpha = mo['alpha electrons'] || 0;
    const nBeta = mo['beta electrons'] || 0;

    if (isUnrestricted && result.orbitalEnergies && !Array.isArray(result.orbitalEnergies)) {
        const ae = result.orbitalEnergies.alpha;
        const be = result.orbitalEnergies.beta;

        result.orbitalOccupations = {
            alpha: ae.map((_, i) => i < nAlpha ? 1.0 : 0.0),
            beta: be.map((_, i) => i < nBeta ? 1.0 : 0.0),
            isUnrestricted: true,
        };
        log(`Set alpha/beta occupations: ${nAlpha} alpha, ${nBeta} beta electrons`);

        // HOMO/LUMO
        const alphaHOMO = nAlpha > 0 && nAlpha <= ae.length ? ae[nAlpha - 1] : null;
        const alphaLUMO = nAlpha < ae.length ? ae[nAlpha] : null;
        const betaHOMO = nBeta > 0 && nBeta <= be.length ? be[nBeta - 1] : null;
        const betaLUMO = nBeta < be.length ? be[nBeta] : null;

        result.properties = {
            alphaHOMO: alphaHOMO != null ? alphaHOMO * HA_TO_EV : undefined,
            alphaLUMO: alphaLUMO != null ? alphaLUMO * HA_TO_EV : undefined,
            betaHOMO: betaHOMO != null ? betaHOMO * HA_TO_EV : undefined,
            betaLUMO: betaLUMO != null ? betaLUMO * HA_TO_EV : undefined,
            isUnrestricted: true,
        };

        if (alphaHOMO != null) log(`Alpha HOMO: ${alphaHOMO.toFixed(6)} Ha (${(alphaHOMO * HA_TO_EV).toFixed(4)} eV)`);
        if (alphaLUMO != null) log(`Alpha LUMO: ${alphaLUMO.toFixed(6)} Ha (${(alphaLUMO * HA_TO_EV).toFixed(4)} eV)`);
        if (betaHOMO != null) log(`Beta HOMO: ${betaHOMO.toFixed(6)} Ha (${(betaHOMO * HA_TO_EV).toFixed(4)} eV)`);
        if (betaLUMO != null) log(`Beta LUMO: ${betaLUMO.toFixed(6)} Ha (${(betaLUMO * HA_TO_EV).toFixed(4)} eV)`);

    } else if (result.orbitalEnergies && Array.isArray(result.orbitalEnergies)) {
        const oe = result.orbitalEnergies;
        const occupationArray: number[] = [];
        for (let i = 0; i < oe.length; i++) {
            if (i < Math.min(nAlpha, nBeta)) occupationArray.push(2.0);
            else if (i < Math.max(nAlpha, nBeta)) occupationArray.push(1.0);
            else occupationArray.push(0.0);
        }
        result.orbitalOccupations = occupationArray;
        log(`Set orbital occupations based on ${nAlpha} alpha and ${nBeta} beta electrons`);

        // HOMO/LUMO
        if (oe.length > 0) {
            const homoIndex = Math.max(nAlpha, nBeta) - 1;
            const lumoIndex = homoIndex + 1;
            if (homoIndex >= 0 && homoIndex < oe.length) {
                const homo = Number(oe[homoIndex]);
                const lumo = lumoIndex < oe.length ? Number(oe[lumoIndex]) : null;
                if (!isNaN(homo)) {
                    result.properties = {
                        homo: homo * HA_TO_EV,
                        lumo: (lumo != null && !isNaN(lumo)) ? lumo * HA_TO_EV : undefined,
                        gap: (lumo != null && !isNaN(lumo)) ? (lumo - homo) * HA_TO_EV : undefined,
                    };
                    log(`HOMO: ${homo.toFixed(6)} Ha (${(homo * HA_TO_EV).toFixed(4)} eV)`);
                    if (lumo != null && !isNaN(lumo)) {
                        log(`LUMO: ${lumo.toFixed(6)} Ha (${(lumo * HA_TO_EV).toFixed(4)} eV)`);
                        log(`Gap: ${((lumo - homo) * HA_TO_EV).toFixed(4)} eV`);
                    }
                }
            }
        }
    }
}

// ── Wavefunction metadata ──────────────────────────────────────────────────

function parseWavefunctionMetadata(
    result: CalculationResult,
    owfJson: any,
    mo: any,
    owfText: string,
    log: (msg: string, level?: ParseLog['level']) => void,
): void {
    if (owfJson.atoms && mo) {
        const basisFunctions = owfJson['basis functions'] || [];
        result.wavefunctionData = {
            numBasisFunctions: basisFunctions.length || 0,
            numAtoms: owfJson.atoms.length || 0,
            nAlpha: mo['alpha electrons'] || 0,
            nBeta: mo['beta electrons'] || 0,
            owfJson: owfText,
        };
        log('Stored wavefunction metadata');
    } else {
        log(`Warning: Missing atoms or mo in owf.json. Has atoms: ${!!owfJson.atoms}, Has mo: ${!!mo}`, 'warn');
    }
}

// ── Matrices ───────────────────────────────────────────────────────────────

function arrayToMatrix(matrixData: number[][]): MatrixData {
    return { rows: matrixData.length, cols: matrixData[0]?.length || 0, data: matrixData };
}

function tryExtractMatrix(
    source: any,
    key: string,
    target: Matrices,
    targetKey: keyof Matrices,
    log: (msg: string, level?: ParseLog['level']) => void,
): void {
    const data = source[key];
    if (data && Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
        target[targetKey] = arrayToMatrix(data);
        log(`Extracted ${targetKey} matrix (${data.length}x${data[0].length})`);
    }
}

function parseMatrices(
    result: CalculationResult,
    owfJson: any,
    mo: any,
    log: (msg: string, level?: ParseLog['level']) => void,
): void {
    try {
        const matrices: Matrices = {};

        tryExtractMatrix(owfJson, 'kinetic energy matrix', matrices, 'kinetic', log);
        tryExtractMatrix(owfJson, 'nuclear attraction matrix', matrices, 'nuclear', log);

        // Overlap matrix: check multiple locations
        const overlapSource = owfJson['overlap matrix']
            ?? owfJson['orbital basis']?.['overlap matrix']
            ?? mo?.['overlap matrix'];
        if (overlapSource && Array.isArray(overlapSource) && overlapSource.length > 0 && Array.isArray(overlapSource[0])) {
            matrices.overlap = arrayToMatrix(overlapSource);
            log(`Extracted overlap matrix (${overlapSource.length}x${overlapSource[0].length})`);
        } else {
            log('Overlap matrix not found in OWF JSON', 'warn');
        }

        if (mo) {
            tryExtractMatrix(mo, 'density matrix', matrices, 'density', log);
            tryExtractMatrix(mo, 'orbital coefficients', matrices, 'coefficients', log);
        }

        const numMatrices = Object.keys(matrices).length;
        if (numMatrices > 0) {
            result.matrices = matrices;
            log(`Extracted ${numMatrices} matrices from wavefunction data`);
        } else {
            log('No matrices found in wavefunction data', 'warn');
        }
    } catch (err: any) {
        log(`Warning: Failed to extract matrices: ${err.message}`, 'warn');
    }
}

// ── FCHK file ──────────────────────────────────────────────────────────────

function parseFCHK(
    result: CalculationResult,
    files: Record<string, Uint8Array>,
    log: (msg: string, level?: ParseLog['level']) => void,
): void {
    const fchkPath = Object.keys(files).find(p => p.endsWith('.owf.fchk') || p.endsWith('.fchk'));
    if (fchkPath) {
        const fchkText = new TextDecoder().decode(files[fchkPath]);
        log(`Found FCHK file: ${fchkPath} (${files[fchkPath].length} bytes)`);
        if (result.wavefunctionData) {
            result.wavefunctionData.fchk = fchkText;
        }
    } else {
        log('Warning: No FCHK file found in output', 'warn');
    }
}

// ── Optimization trajectory ────────────────────────────────────────────────

function parseOptimization(
    result: CalculationResult,
    files: Record<string, Uint8Array>,
    finalEnergy: number,
    converged: boolean,
    log: (msg: string, level?: ParseLog['level']) => void,
): void {
    const trjPath = Object.keys(files).find(p => p.endsWith('_trj.xyz'));
    const optPath = Object.keys(files).find(p => p.endsWith('_opt.xyz'));
    if (!trjPath || !optPath) return;

    log(`Found optimization files: ${trjPath}, ${optPath}`);

    try {
        const trjData = new TextDecoder().decode(files[trjPath]);
        const optData = new TextDecoder().decode(files[optPath]);

        const trjFrames = trjData.trim().split(/\n(?=\d+\n)/);
        const geometries: string[] = [];
        const energies: number[] = [];
        const gradientNorms: number[] = [];

        for (const frame of trjFrames) {
            if (!frame.trim()) continue;
            geometries.push(frame.trim());

            const lines = frame.trim().split('\n');
            if (lines.length >= 2) {
                const comment = lines[1];
                const eMatch = comment.match(/energy[=:\s]+([-\d.]+)/i);
                if (eMatch) energies.push(parseFloat(eMatch[1]));
                const gMatch = comment.match(/grad(?:ient)?[=:\s]+([-\d.]+)/i);
                if (gMatch) gradientNorms.push(parseFloat(gMatch[1]));
            }
        }

        result.optimization = {
            trajectory: {
                energies: energies.length > 0 ? energies : [finalEnergy],
                gradientNorms,
                geometries,
                converged,
                steps: geometries.length,
                finalEnergy,
                finalMolecule: null,
            },
            finalXYZ: optData,
            steps: geometries.length,
            energies: energies.length > 0 ? energies : [finalEnergy],
            gradientNorms,
        };

        log(`Parsed optimization trajectory: ${geometries.length} steps`);
    } catch (err: any) {
        log(`Warning: Failed to parse optimization files: ${err.message}`, 'warn');
    }
}

// ── Frequency data ─────────────────────────────────────────────────────────

function parseFrequencies(
    result: CalculationResult,
    files: Record<string, Uint8Array>,
    owfJson: any,
    log: (msg: string, level?: ParseLog['level']) => void,
): void {
    const freqPath = Object.keys(files).find(p => p.endsWith('_freq.json'));
    if (!freqPath) return;

    log(`Found frequency file: ${freqPath}`);

    try {
        const freqData = new TextDecoder().decode(files[freqPath]);
        const freqJson = JSON.parse(freqData);
        log(`Frequency JSON keys: ${Object.keys(freqJson).join(', ')}`);

        const frequenciesRaw = freqJson.frequencies_cm || freqJson.sorted_frequencies_cm || [];
        const normalModesRaw = freqJson.normal_modes || [];
        const nAtoms = freqJson.n_atoms || owfJson.atoms?.length || 0;
        const nModes = freqJson.n_modes || frequenciesRaw.length;

        const frequencies = frequenciesRaw.map((f: number | number[]) =>
            Array.isArray(f) ? f[0] : f
        );

        // Transpose normal modes: rows → columns
        const normalModes: number[][] = [];
        if (Array.isArray(normalModesRaw) && normalModesRaw.length > 0 && nModes > 0) {
            if (Array.isArray(normalModesRaw[0])) {
                const nRows = normalModesRaw.length;
                const nCols = normalModesRaw[0].length;
                log(`Normal modes matrix: ${nRows} rows x ${nCols} cols`);

                for (let col = 0; col < nCols; col++) {
                    const mode: number[] = [];
                    for (let row = 0; row < nRows; row++) {
                        mode.push(normalModesRaw[row][col]);
                    }
                    normalModes.push(mode);
                }
            } else {
                log('Warning: normal_modes is not a 2D array', 'warn');
            }
        }

        if (frequencies.length > 0) {
            result.frequencies = {
                frequencies,
                nModes,
                nAtoms,
                summary: `${frequencies.length} vibrational modes`,
                normalModes,
            };

            log(`Parsed ${frequencies.length} vibrational frequencies`);
            const preview = frequencies.slice(0, 5).map((f: number) =>
                f < 0 ? `${Math.abs(f).toFixed(1)}i` : f.toFixed(1)
            ).join(', ');
            log(`First frequencies: ${preview} cm\u207B\u00B9`);

            if (normalModes.length > 0) {
                log(`Parsed ${normalModes.length} normal modes (${normalModes[0].length} elements each)`);
            } else {
                log('Warning: No normal mode data found', 'warn');
            }
        } else {
            log('Warning: No frequencies found in frequency JSON', 'warn');
        }
    } catch (err: any) {
        log(`Warning: Failed to parse frequency file: ${err.message}`, 'warn');
    }
}
