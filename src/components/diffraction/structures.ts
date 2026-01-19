/**
 * Predefined crystal structures for diffraction simulation
 *
 * All positions are in fractional coordinates (0-1)
 * Atoms array contains ALL atoms in the unit cell
 */

import type { CrystalStructure, Atom } from './physics';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate FCC positions from a basis atom
 * FCC has atoms at: (0,0,0), (0.5,0.5,0), (0.5,0,0.5), (0,0.5,0.5)
 */
function generateFCCPositions(
    element: string,
    atomicNumber: number,
    basis: [number, number, number]
): Atom[] {
    const fccOffsets: [number, number, number][] = [
        [0, 0, 0],
        [0.5, 0.5, 0],
        [0.5, 0, 0.5],
        [0, 0.5, 0.5],
    ];

    return fccOffsets.map((offset) => ({
        element,
        position: [
            (basis[0] + offset[0]) % 1,
            (basis[1] + offset[1]) % 1,
            (basis[2] + offset[2]) % 1,
        ] as [number, number, number],
        atomicNumber,
    }));
}

/**
 * Wrap fractional coordinate to [0, 1) range
 */
function wrap(x: number): number {
    const w = x % 1;
    return w < 0 ? w + 1 : w;
}

// ============================================================================
// Crystal Structures
// ============================================================================

/**
 * NaCl (Rock salt structure)
 * FCC lattice with Na at (0,0,0) and Cl at (0.5,0.5,0.5)
 * Space group: Fm-3m (225)
 * a = 5.64 Å
 */
export const NaCl: CrystalStructure = {
    name: 'Sodium Chloride (NaCl)',
    spaceGroup: 'Fm-3m',
    latticeType: 'fcc',
    a: 5.64,
    atoms: [
        // Na atoms at FCC positions
        ...generateFCCPositions('Na', 11, [0, 0, 0]),
        // Cl atoms at FCC positions shifted by (0.5, 0.5, 0.5)
        ...generateFCCPositions('Cl', 17, [0.5, 0.5, 0.5]),
    ],
};

/**
 * CsCl (Cesium chloride structure)
 * Simple cubic with Cs at (0,0,0) and Cl at (0.5,0.5,0.5)
 * Space group: Pm-3m (221)
 * a = 4.11 Å
 */
export const CsCl: CrystalStructure = {
    name: 'Cesium Chloride (CsCl)',
    spaceGroup: 'Pm-3m',
    latticeType: 'cubic',
    a: 4.11,
    atoms: [
        { element: 'Cs', position: [0, 0, 0], atomicNumber: 55 },
        { element: 'Cl', position: [0.5, 0.5, 0.5], atomicNumber: 17 },
    ],
};

/**
 * Diamond (Carbon)
 * FCC with basis at (0,0,0) and (0.25,0.25,0.25)
 * Space group: Fd-3m (227)
 * a = 3.567 Å
 */
export const Diamond: CrystalStructure = {
    name: 'Diamond (C)',
    spaceGroup: 'Fd-3m',
    latticeType: 'fcc',
    a: 3.567,
    atoms: [
        // C atoms at FCC positions
        ...generateFCCPositions('C', 6, [0, 0, 0]),
        // C atoms at FCC positions shifted by (0.25, 0.25, 0.25)
        ...generateFCCPositions('C', 6, [0.25, 0.25, 0.25]),
    ],
};

/**
 * Benzene (C6H6) - Pbca structure (space group 61)
 * 4 molecules in orthorhombic cell
 * Space group: Pbca (No. 61)
 * a = 7.39 Å, b = 9.42 Å, c = 6.81 Å
 */
export const Benzene: CrystalStructure = {
    name: 'Benzene (C₆H₆)',
    spaceGroup: 'Pbca',
    latticeType: 'orthorhombic',
    a: 7.39,
    b: 9.42,
    c: 6.81,
    atoms: [
        // Molecule 1
        { element: 'C', position: [wrap(-0.0607), 0.1393, wrap(-0.0069)], atomicNumber: 6 },
        { element: 'C', position: [wrap(-0.1377), 0.0447, 0.1260], atomicNumber: 6 },
        { element: 'C', position: [0.0770, 0.0958, wrap(-0.1325)], atomicNumber: 6 },
        { element: 'C', position: [wrap(-0.0770), wrap(-0.0958), 0.1325], atomicNumber: 6 },
        { element: 'C', position: [0.1377, wrap(-0.0447), wrap(-0.1260)], atomicNumber: 6 },
        { element: 'C', position: [0.0607, wrap(-0.1393), 0.0069], atomicNumber: 6 },
        { element: 'H', position: [wrap(-0.1046), 0.2502, wrap(-0.0123)], atomicNumber: 1 },
        { element: 'H', position: [wrap(-0.2458), 0.0781, 0.2241], atomicNumber: 1 },
        { element: 'H', position: [0.1371, 0.1681, wrap(-0.2360)], atomicNumber: 1 },
        { element: 'H', position: [wrap(-0.1371), wrap(-0.1681), 0.2360], atomicNumber: 1 },
        { element: 'H', position: [0.2458, wrap(-0.0781), wrap(-0.2241)], atomicNumber: 1 },
        { element: 'H', position: [0.1046, wrap(-0.2502), 0.0123], atomicNumber: 1 },
        // Molecule 2
        { element: 'C', position: [0.0607, 0.6393, 0.5069], atomicNumber: 6 },
        { element: 'C', position: [0.1377, 0.5447, 0.3740], atomicNumber: 6 },
        { element: 'C', position: [wrap(-0.0770), 0.5958, 0.6325], atomicNumber: 6 },
        { element: 'C', position: [0.0770, 0.4042, 0.3675], atomicNumber: 6 },
        { element: 'C', position: [wrap(-0.1377), 0.4553, 0.6260], atomicNumber: 6 },
        { element: 'C', position: [wrap(-0.0607), 0.3607, 0.4931], atomicNumber: 6 },
        { element: 'H', position: [0.1046, 0.7502, 0.5123], atomicNumber: 1 },
        { element: 'H', position: [0.2458, 0.5781, 0.2759], atomicNumber: 1 },
        { element: 'H', position: [wrap(-0.1371), 0.6681, 0.7360], atomicNumber: 1 },
        { element: 'H', position: [0.1371, 0.3319, 0.2640], atomicNumber: 1 },
        { element: 'H', position: [wrap(-0.2458), 0.4219, 0.7241], atomicNumber: 1 },
        { element: 'H', position: [wrap(-0.1046), 0.2498, 0.4877], atomicNumber: 1 },
        // Molecule 3
        { element: 'C', position: [0.5607, wrap(-0.1393), 0.4931], atomicNumber: 6 },
        { element: 'C', position: [0.6377, wrap(-0.0447), 0.6260], atomicNumber: 6 },
        { element: 'C', position: [0.4230, wrap(-0.0958), 0.3675], atomicNumber: 6 },
        { element: 'C', position: [0.5770, 0.0958, 0.6325], atomicNumber: 6 },
        { element: 'C', position: [0.3623, 0.0447, 0.3740], atomicNumber: 6 },
        { element: 'C', position: [0.4393, 0.1393, 0.5069], atomicNumber: 6 },
        { element: 'H', position: [0.6046, wrap(-0.2502), 0.4877], atomicNumber: 1 },
        { element: 'H', position: [0.7458, wrap(-0.0781), 0.7241], atomicNumber: 1 },
        { element: 'H', position: [0.3629, wrap(-0.1681), 0.2640], atomicNumber: 1 },
        { element: 'H', position: [0.6371, 0.1681, 0.7360], atomicNumber: 1 },
        { element: 'H', position: [0.2542, 0.0781, 0.2759], atomicNumber: 1 },
        { element: 'H', position: [0.3954, 0.2502, 0.5123], atomicNumber: 1 },
        // Molecule 4
        { element: 'C', position: [0.5607, 0.6393, wrap(-0.0069)], atomicNumber: 6 },
        { element: 'C', position: [0.6377, 0.5447, 0.1260], atomicNumber: 6 },
        { element: 'C', position: [0.4230, 0.5958, wrap(-0.1325)], atomicNumber: 6 },
        { element: 'C', position: [0.5770, 0.4042, 0.1325], atomicNumber: 6 },
        { element: 'C', position: [0.3623, 0.4553, wrap(-0.1260)], atomicNumber: 6 },
        { element: 'C', position: [0.4393, 0.3607, 0.0069], atomicNumber: 6 },
        { element: 'H', position: [0.6046, 0.7502, wrap(-0.0123)], atomicNumber: 1 },
        { element: 'H', position: [0.7458, 0.5781, 0.2241], atomicNumber: 1 },
        { element: 'H', position: [0.3629, 0.6681, wrap(-0.2360)], atomicNumber: 1 },
        { element: 'H', position: [0.6371, 0.3319, 0.2360], atomicNumber: 1 },
        { element: 'H', position: [0.2542, 0.4219, wrap(-0.2241)], atomicNumber: 1 },
        { element: 'H', position: [0.3954, 0.2498, 0.0123], atomicNumber: 1 },
    ],
};

// ============================================================================
// Structure Registry
// ============================================================================

export const STRUCTURES: Record<string, CrystalStructure> = {
    NaCl,
    CsCl,
    Diamond,
    Benzene,
};

export const STRUCTURE_LIST = Object.entries(STRUCTURES).map(([key, structure]) => ({
    id: key,
    name: structure.name,
}));

export default STRUCTURES;
