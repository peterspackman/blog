/**
 * Physics utilities for 2D particle in a box visualization
 */

export interface QuantumState2D {
    nx: number;
    ny: number;
}

export type DisplayMode = 'probability' | 'real' | 'imaginary';
export type ColorMapType = 'viridis' | 'plasma' | 'coolwarm';

/**
 * Calculate energy of a 2D box state (in units of pi^2 hbar^2 / 2mL^2)
 */
export function calcEnergy(nx: number, ny: number): number {
    return nx * nx + ny * ny;
}

/**
 * Get color based on energy level for phasor display (returns hex for alpha compatibility)
 */
export function getEnergyColor(nx: number, ny: number, maxQuantumNumber: number): string {
    const energy = calcEnergy(nx, ny);
    const maxEnergy = 2 * maxQuantumNumber * maxQuantumNumber;
    const normalizedEnergy = Math.min(energy / maxEnergy, 1);

    let r: number, g: number, b: number;
    if (normalizedEnergy < 0.5) {
        const t = normalizedEnergy * 2;
        r = Math.round(77 + t * 178);
        g = Math.round(128 + t * 127);
        b = 255;
    } else {
        const t = (normalizedEnergy - 0.5) * 2;
        r = 255;
        g = Math.round(255 - t * 153);
        b = Math.round(255 - t * 204);
    }

    // Return hex color so we can append alpha like #rrggbbaa
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Format state string for display
 */
export function formatStateString(states: QuantumState2D[]): string {
    return states.map(s => `(${s.nx},${s.ny})`).join(', ');
}

/**
 * Get display mode name
 */
export function getDisplayModeName(mode: DisplayMode): string {
    switch (mode) {
        case 'probability': return 'Probability Density';
        case 'real': return 'Real Part';
        case 'imaginary': return 'Imaginary Part';
    }
}

/**
 * Get color map display name
 */
export function getColorMapName(type: ColorMapType): string {
    switch (type) {
        case 'viridis': return 'Viridis';
        case 'plasma': return 'Plasma';
        case 'coolwarm': return 'Cool-Warm';
    }
}

/**
 * Maximum quantum number supported
 */
export const MAX_QUANTUM_NUMBER = 5;

/**
 * Maximum number of active states
 */
export const MAX_ACTIVE_STATES = 10;
