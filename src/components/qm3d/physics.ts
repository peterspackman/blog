/**
 * Physics types and constants for 3D Particle in a Box visualization
 *
 * 3D wavefunctions: ψ(x,y,z) = sin(nx·πx/L) · sin(ny·πy/L) · sin(nz·πz/L)
 * Energy: E = nx² + ny² + nz²  (in units of π²ℏ²/2mL²)
 */

// Maximum quantum number for each dimension
export const MAX_QUANTUM_NUMBER = 4;

// Maximum number of active states to superpose
export const MAX_ACTIVE_STATES = 8;

// 3D quantum state
export interface QuantumState3D {
    nx: number;
    ny: number;
    nz: number;
}

// Color map types (reuse from QM2D)
export type ColorMapType = 'viridis' | 'plasma' | 'coolwarm';

// Render style options
export type RenderStyle = 'colorful' | 'absorption';

/**
 * Calculate energy for a 3D particle in a box state
 * E = nx² + ny² + nz² (in dimensionless units)
 */
export function calcEnergy(nx: number, ny: number, nz: number): number {
    return nx * nx + ny * ny + nz * nz;
}

/**
 * Calculate energy for a QuantumState3D object
 */
export function calcStateEnergy(state: QuantumState3D): number {
    return calcEnergy(state.nx, state.ny, state.nz);
}

/**
 * Format quantum state as string for display
 */
export function formatState(state: QuantumState3D): string {
    return `(${state.nx}, ${state.ny}, ${state.nz})`;
}

/**
 * Format multiple states as a string
 */
export function formatStateString(states: QuantumState3D[]): string {
    return states.map(formatState).join(' + ');
}

/**
 * Check if two states are equal
 */
export function statesEqual(a: QuantumState3D, b: QuantumState3D): boolean {
    return a.nx === b.nx && a.ny === b.ny && a.nz === b.nz;
}

/**
 * Get default initial state
 */
export function getDefaultState(): QuantumState3D {
    return { nx: 1, ny: 1, nz: 1 };
}

/**
 * Preset state combinations for interesting visualizations
 */
export const PRESET_STATES: { name: string; states: QuantumState3D[] }[] = [
    { name: 'Ground State', states: [{ nx: 1, ny: 1, nz: 1 }] },
    { name: 'First Excited (x)', states: [{ nx: 2, ny: 1, nz: 1 }] },
    { name: 'First Excited (y)', states: [{ nx: 1, ny: 2, nz: 1 }] },
    { name: 'First Excited (z)', states: [{ nx: 1, ny: 1, nz: 2 }] },
    { name: 'Degenerate Pair', states: [{ nx: 2, ny: 1, nz: 1 }, { nx: 1, ny: 2, nz: 1 }] },
    { name: 'Triple Degeneracy', states: [{ nx: 2, ny: 1, nz: 1 }, { nx: 1, ny: 2, nz: 1 }, { nx: 1, ny: 1, nz: 2 }] },
    { name: 'Nodal Pattern', states: [{ nx: 2, ny: 2, nz: 2 }] },
    { name: 'Complex Superposition', states: [{ nx: 1, ny: 1, nz: 1 }, { nx: 2, ny: 2, nz: 1 }] },
];
