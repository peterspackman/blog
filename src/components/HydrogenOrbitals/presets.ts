/**
 * Chemistry-labelled orbital presets.
 *
 *  - Shell orbitals: 1s, 2s, 2p_{x,y,z}, 3s, 3p_{x,y,z}, 3d (five real components),
 *    4s, 4p_{x,y,z}, 4d (five), 4f (seven).
 *  - Hybrid orbitals: one representative from each of sp, sp², sp³ — enough
 *    to demonstrate how LCAO builds directional bonding orbitals.
 *
 * The label→(n,l,m) mapping follows the standard chemistry convention:
 *   m > 0 cosine  → p_x, d_{xz}, d_{x²−y²}, f_{xzz}, …
 *   m < 0 sine    → p_y, d_{yz}, d_{xy},   f_{yzz}, …
 *   m = 0         → p_z, d_{z²},  f_{z³}
 *
 * Normalization: hybrid presets have coefficients chosen so Σ|cᵢ|² = 1.
 */

import type { OrbitalPreset } from './types';

const shell = (n: number, name: string): OrbitalPreset['shell'] => `${n}${name}`;

// -----------------------------------------------------------------------
// Shell orbitals (pure (n, l, m))
// -----------------------------------------------------------------------

export const SHELL_PRESETS: OrbitalPreset[] = [
    // n = 1
    {
        id: '1s',
        label: '1s',
        latex: '1s',
        category: 'shell',
        shell: shell(1, 's'),
        terms: [{ n: 1, l: 0, m: 0, coeff: 1 }],
    },

    // n = 2
    {
        id: '2s',
        label: '2s',
        latex: '2s',
        category: 'shell',
        shell: shell(2, 's'),
        terms: [{ n: 2, l: 0, m: 0, coeff: 1 }],
    },
    {
        id: '2p_x',
        label: '2p_x',
        latex: '2p_x',
        category: 'shell',
        shell: shell(2, 'p'),
        terms: [{ n: 2, l: 1, m: +1, coeff: 1 }],
    },
    {
        id: '2p_y',
        label: '2p_y',
        latex: '2p_y',
        category: 'shell',
        shell: shell(2, 'p'),
        terms: [{ n: 2, l: 1, m: -1, coeff: 1 }],
    },
    {
        id: '2p_z',
        label: '2p_z',
        latex: '2p_z',
        category: 'shell',
        shell: shell(2, 'p'),
        terms: [{ n: 2, l: 1, m: 0, coeff: 1 }],
    },

    // n = 3
    {
        id: '3s',
        label: '3s',
        latex: '3s',
        category: 'shell',
        shell: shell(3, 's'),
        terms: [{ n: 3, l: 0, m: 0, coeff: 1 }],
    },
    {
        id: '3p_x',
        label: '3p_x',
        latex: '3p_x',
        category: 'shell',
        shell: shell(3, 'p'),
        terms: [{ n: 3, l: 1, m: +1, coeff: 1 }],
    },
    {
        id: '3p_y',
        label: '3p_y',
        latex: '3p_y',
        category: 'shell',
        shell: shell(3, 'p'),
        terms: [{ n: 3, l: 1, m: -1, coeff: 1 }],
    },
    {
        id: '3p_z',
        label: '3p_z',
        latex: '3p_z',
        category: 'shell',
        shell: shell(3, 'p'),
        terms: [{ n: 3, l: 1, m: 0, coeff: 1 }],
    },
    {
        id: '3d_z2',
        label: '3d_{z²}',
        latex: '3d_{z^2}',
        category: 'shell',
        shell: shell(3, 'd'),
        terms: [{ n: 3, l: 2, m: 0, coeff: 1 }],
    },
    {
        id: '3d_xz',
        label: '3d_{xz}',
        latex: '3d_{xz}',
        category: 'shell',
        shell: shell(3, 'd'),
        terms: [{ n: 3, l: 2, m: +1, coeff: 1 }],
    },
    {
        id: '3d_yz',
        label: '3d_{yz}',
        latex: '3d_{yz}',
        category: 'shell',
        shell: shell(3, 'd'),
        terms: [{ n: 3, l: 2, m: -1, coeff: 1 }],
    },
    {
        id: '3d_x2y2',
        label: '3d_{x²−y²}',
        latex: '3d_{x^2-y^2}',
        category: 'shell',
        shell: shell(3, 'd'),
        terms: [{ n: 3, l: 2, m: +2, coeff: 1 }],
    },
    {
        id: '3d_xy',
        label: '3d_{xy}',
        latex: '3d_{xy}',
        category: 'shell',
        shell: shell(3, 'd'),
        terms: [{ n: 3, l: 2, m: -2, coeff: 1 }],
    },

    // n = 4  (s, p, d, f)
    {
        id: '4s',
        label: '4s',
        latex: '4s',
        category: 'shell',
        shell: shell(4, 's'),
        terms: [{ n: 4, l: 0, m: 0, coeff: 1 }],
    },
    {
        id: '4p_z',
        label: '4p_z',
        latex: '4p_z',
        category: 'shell',
        shell: shell(4, 'p'),
        terms: [{ n: 4, l: 1, m: 0, coeff: 1 }],
    },
    {
        id: '4d_z2',
        label: '4d_{z²}',
        latex: '4d_{z^2}',
        category: 'shell',
        shell: shell(4, 'd'),
        terms: [{ n: 4, l: 2, m: 0, coeff: 1 }],
    },
    {
        id: '4f_z3',
        label: '4f_{z³}',
        latex: '4f_{z^3}',
        category: 'shell',
        shell: shell(4, 'f'),
        terms: [{ n: 4, l: 3, m: 0, coeff: 1 }],
    },
    {
        id: '4f_xz2',
        label: '4f_{xz²}',
        latex: '4f_{xz^2}',
        category: 'shell',
        shell: shell(4, 'f'),
        terms: [{ n: 4, l: 3, m: +1, coeff: 1 }],
    },
    {
        id: '4f_yz2',
        label: '4f_{yz²}',
        latex: '4f_{yz^2}',
        category: 'shell',
        shell: shell(4, 'f'),
        terms: [{ n: 4, l: 3, m: -1, coeff: 1 }],
    },
    {
        id: '4f_xyz',
        label: '4f_{xyz}',
        latex: '4f_{xyz}',
        category: 'shell',
        shell: shell(4, 'f'),
        terms: [{ n: 4, l: 3, m: -2, coeff: 1 }],
    },
    {
        id: '4f_zx2y2',
        label: '4f_{z(x²−y²)}',
        latex: '4f_{z(x^2-y^2)}',
        category: 'shell',
        shell: shell(4, 'f'),
        terms: [{ n: 4, l: 3, m: +2, coeff: 1 }],
    },
    {
        id: '4f_xxx',
        label: '4f_{x(x²−3y²)}',
        latex: '4f_{x(x^2-3y^2)}',
        category: 'shell',
        shell: shell(4, 'f'),
        terms: [{ n: 4, l: 3, m: +3, coeff: 1 }],
    },
    {
        id: '4f_yyy',
        label: '4f_{y(3x²−y²)}',
        latex: '4f_{y(3x^2-y^2)}',
        category: 'shell',
        shell: shell(4, 'f'),
        terms: [{ n: 4, l: 3, m: -3, coeff: 1 }],
    },
];

// -----------------------------------------------------------------------
// Hybrid orbitals (one representative per family)
// -----------------------------------------------------------------------
//
//  sp   (linear, along +z):  (1/√2) · (2s + 2p_z)
//  sp²  (trigonal planar, one of three in +x direction):
//         (1/√3) · 2s + (√(2/3)) · 2p_x
//  sp³  (tetrahedral, one along [1,1,1]):
//         (1/2) · (2s + 2p_x + 2p_y + 2p_z)
//
// Coefficients satisfy Σ|cᵢ|² = 1 so the hybrid is normalized provided the
// constituent basis orbitals are orthonormal.

const INV_SQRT2 = 1 / Math.SQRT2;
const INV_SQRT3 = 1 / Math.sqrt(3);
const SQRT2_OVER_3 = Math.sqrt(2 / 3);

export const HYBRID_PRESETS: OrbitalPreset[] = [
    {
        id: 'sp_z',
        label: 'sp (along +z)',
        latex: '\\tfrac{1}{\\sqrt{2}}(2s + 2p_z)',
        category: 'hybrid',
        terms: [
            { n: 2, l: 0, m: 0, coeff: INV_SQRT2 },
            { n: 2, l: 1, m: 0, coeff: INV_SQRT2 },
        ],
    },
    {
        id: 'sp2_x',
        label: 'sp² (along +x)',
        latex: '\\tfrac{1}{\\sqrt{3}}\\,2s + \\sqrt{\\tfrac{2}{3}}\\,2p_x',
        category: 'hybrid',
        terms: [
            { n: 2, l: 0, m: 0, coeff: INV_SQRT3 },
            { n: 2, l: 1, m: +1, coeff: SQRT2_OVER_3 },
        ],
    },
    {
        id: 'sp3_111',
        label: 'sp³ (along [1,1,1])',
        latex: '\\tfrac{1}{2}(2s + 2p_x + 2p_y + 2p_z)',
        category: 'hybrid',
        terms: [
            { n: 2, l: 0, m: 0, coeff: 0.5 },
            { n: 2, l: 1, m: +1, coeff: 0.5 }, // p_x
            { n: 2, l: 1, m: -1, coeff: 0.5 }, // p_y
            { n: 2, l: 1, m: 0, coeff: 0.5 }, // p_z
        ],
    },
];

export const ALL_PRESETS: OrbitalPreset[] = [...SHELL_PRESETS, ...HYBRID_PRESETS];

/** Lookup a preset by id. */
export function findPreset(id: string): OrbitalPreset | undefined {
    return ALL_PRESETS.find((p) => p.id === id);
}

/** Group shell presets by shell identifier ('1s', '2p', '3d', ...). */
export function shellGroups(): Array<{ shell: string; presets: OrbitalPreset[] }> {
    const groups = new Map<string, OrbitalPreset[]>();
    for (const p of SHELL_PRESETS) {
        if (!p.shell) continue;
        if (!groups.has(p.shell)) groups.set(p.shell, []);
        groups.get(p.shell)!.push(p);
    }
    return Array.from(groups.entries()).map(([s, presets]) => ({ shell: s, presets }));
}
