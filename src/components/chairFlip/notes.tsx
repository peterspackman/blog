import React from 'react';
import type { NamedMeasure } from '../reactionPath/measures';

/**
 * One line on what to look at at each stationary point of the
 * methylcyclohexane path, in path order. Numbers are from the GFN2 geometries.
 */
export interface PointNote {
    /** Label on the profile. */
    short: string;
    body: React.ReactNode;
}

export const METHYLCYCLOHEXANE_NOTES: PointNote[] = [
    { short: 'Chair (eq)', body: 'All bonds staggered, methyl equatorial (orange).' },
    { short: 'Half-chair', body: 'Four carbons nearly coplanar; eclipsed bonds and C–C–C angles opened to 118°.' },
    { short: 'Twist-boat', body: 'A shallow minimum between the half-chair and the boat.' },
    { short: 'Boat', body: 'Flagpole hydrogens on C1 and C4 2.3 Å apart; links two twist-boats.' },
    { short: 'Twist-boat', body: 'The other twist-boat, at the same energy as the first.' },
    { short: 'Half-chair', body: 'Four carbons nearly coplanar again, on the way into the other chair.' },
    {
        short: 'Chair (ax)',
        body: 'Methyl axial: 2.3 Å from the axial hydrogens on C3 and C5, 6.3 kJ/mol above equatorial.',
    },
];

/**
 * The measurements worth watching on this path. Atom 0 is the methyl carbon;
 * hydrogens are by index in the path data: H8 is the methyl hydrogen that
 * ends up against the axial hydrogens on C3 (H13) and C5 (H17), and H10/H16
 * are the boat's flagpole hydrogens on C1 and C4.
 */
export function methylcyclohexaneMeasures(ring: readonly number[]): NamedMeasure[] {
    const [c1, c2, c3, c4] = ring;
    return [
        { key: 'methyl', label: 'Me–C1–C2–C3 torsion', defs: [[0, c1, c2, c3]] },
        { key: 'ring', label: 'C1–C2–C3–C4 torsion', defs: [[c1, c2, c3, c4]] },
        { key: 'diaxial', label: '1,3-diaxial H···H', defs: [[8, 13], [8, 17]] },
        { key: 'flagpole', label: 'Flagpole H···H', defs: [[10, 16]] },
    ];
}
