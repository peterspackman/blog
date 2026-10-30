import { parseStructure } from '@peterspackman/ce-chem/parsers';
import { computeFormula } from '@peterspackman/ce-chem/data';
import type { StructureData } from '@peterspackman/ce-chem/data';

/** A parsed input molecule, ready to view and to send to occ. */
export interface Molecule {
    /** The text it was parsed from, kept so the input box can show it. */
    source: string;
    data: StructureData;
    formula: string;
    /** Sum of atomic numbers, before any net charge. */
    nuclearCharge: number;
    /** Net formal charge from an SDF file, when it carries one. */
    formalCharge?: number;
}

/** True for MDL molfile / SD text, which PubChem returns. */
export function looksLikeSdf(text: string): boolean {
    return /\bV[23]000\b/.test(text) || /^M {2}END\s*$/m.test(text);
}

/**
 * Parse XYZ or SDF text into a Molecule. Throws with ce-chem's message when the
 * text isn't a structure, so the input box can show why.
 */
export function parseMolecule(text: string, filename?: string): Molecule {
    const name = filename ?? (looksLikeSdf(text) ? 'input.sdf' : 'input.xyz');
    const data = parseStructure(name, text);
    if (data.atoms.length === 0) throw new Error('No atoms found');
    if (data.periodicity.rank > 0) {
        throw new Error('Periodic structures are not supported here: give a single molecule');
    }
    const charge = data.metadata?.charge;
    return {
        source: text,
        data,
        formula: computeFormula(data.atoms),
        nuclearCharge: data.atoms.reduce((sum, a) => sum + a.atomicNumber, 0),
        formalCharge: typeof charge === 'number' ? charge : undefined,
    };
}

/**
 * Multiplicities allowed for this many electrons: same parity as the electron
 * count, up to one unpaired electron per electron.
 */
export function allowedMultiplicities(electrons: number, max = 7): number[] {
    const out: number[] = [];
    for (let m = electrons % 2 === 0 ? 1 : 2; m <= Math.min(max, electrons + 1); m += 2) out.push(m);
    return out;
}
