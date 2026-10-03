import { useEffect, useState } from 'react';
import type { RDKitModule } from '@rdkit/rdkit';
import type { VizTheme } from '../viz';

// Loaded from a CDN as a script: bundling the wasm through webpack isn't worth it.
// Pinned to the version in package.json so the typings match.
const RDKIT_URL = 'https://unpkg.com/@rdkit/rdkit@2025.3.4-1.0.0/dist/RDKit_minimal.js';

let pending: Promise<RDKitModule> | null = null;

/** Load RDKit.js once per page; later calls share the same module. */
export function loadRDKit(): Promise<RDKitModule> {
    if (pending) return pending;
    pending = new Promise<RDKitModule>((resolve, reject) => {
        const init = () =>
            window.initRDKitModule().then((rdkit) => {
                rdkit.prefer_coordgen(true);
                resolve(rdkit);
            }, reject);
        if (window.initRDKitModule) {
            init();
            return;
        }
        const script = document.createElement('script');
        script.src = RDKIT_URL;
        script.async = true;
        script.onload = init;
        script.onerror = () => reject(new Error('Could not load RDKit.js'));
        document.head.appendChild(script);
    });
    pending.catch(() => {
        pending = null;
    });
    return pending;
}

/** RDKit module once loaded, plus loading/error state. */
export function useRDKit(): { rdkit: RDKitModule | null; error: string } {
    const [rdkit, setRdkit] = useState<RDKitModule | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let live = true;
        loadRDKit().then(
            (m) => live && setRdkit(m),
            (e: Error) => live && setError(e.message),
        );
        return () => {
            live = false;
        };
    }, []);
    return { rdkit, error };
}

function rgb(hex: string): [number, number, number] {
    const h = hex.trim().replace('#', '');
    const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6);
    const n = parseInt(full, 16);
    if (Number.isNaN(n)) return [0, 0, 0];
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** RDKit MolDraw2D options matching the site palette (transparent background). */
export function rdkitDrawOptions(theme: VizTheme, extra: Record<string, unknown> = {}) {
    const text = rgb(theme.text);
    return {
        backgroundColour: [0, 0, 0, 0],
        legendColour: text,
        symbolColour: text,
        annotationColour: rgb(theme.muted),
        atomColourPalette: {
            '-1': text,
            0: text,
            1: text,
            6: text,
            7: rgb(theme.series[0]),
            8: rgb(theme.series[7]),
            9: rgb(theme.series[2]),
            15: rgb(theme.series[1]),
            16: rgb(theme.series[3]),
            17: rgb(theme.series[2]),
            35: rgb(theme.series[4]),
            53: rgb(theme.series[6]),
        },
        ...extra,
    };
}

// RDKit's SVG writer prints C's "nan" for coordinates it failed to lay out.
const BAD_COORDS = /[\s,M]-?nan[\s,]/;

/**
 * Themed 2D depiction of a SMILES string, or null if RDKit can't parse it.
 * Falls back to RDKit's own layout when CoordGen fails (it gives NaN
 * coordinates for hydrogen-only molecules such as [H][H]).
 */
export function moleculeSvg(
    rdkit: RDKitModule,
    smiles: string,
    theme: VizTheme,
    size?: { width: number; height: number; maxFontSize?: number },
): string | null {
    const mol = smiles ? rdkit.get_mol(smiles) : null;
    if (!mol) return null;
    try {
        if (!mol.is_valid()) return null;
        const details = JSON.stringify(rdkitDrawOptions(theme, size ?? {}));
        let svg = mol.get_svg_with_highlights(details);
        if (BAD_COORDS.test(svg)) {
            mol.set_new_coords(false);
            svg = mol.get_svg_with_highlights(details);
        }
        return BAD_COORDS.test(svg) ? null : svg;
    } catch {
        return null;
    } finally {
        mol.delete();
    }
}

const SYMBOLS = (
    'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr ' +
    'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb ' +
    'Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn'
).split(' ');

interface RDKitJsonAtom {
    z?: number;
    impHs?: number;
    chg?: number;
}

/** Hill-order formula (C, H, then alphabetical) with net charge, from RDKit's JSON. */
function formulaFromJson(json: string): string {
    const doc = JSON.parse(json);
    const defaults: Required<RDKitJsonAtom> = { z: 6, impHs: 0, chg: 0, ...doc.defaults?.atom };
    const counts = new Map<string, number>();
    let charge = 0;
    const add = (sym: string, n: number) => n && counts.set(sym, (counts.get(sym) ?? 0) + n);
    for (const mol of doc.molecules ?? []) {
        for (const atom of (mol.atoms ?? []) as RDKitJsonAtom[]) {
            const a = { ...defaults, ...atom };
            add(SYMBOLS[a.z - 1] ?? `Z${a.z}`, 1);
            add('H', a.impHs);
            charge += a.chg;
        }
    }
    const order = [...counts.keys()].sort((a, b) => a.localeCompare(b));
    const hill = counts.has('C') ? ['C', ...(counts.has('H') ? ['H'] : []), ...order.filter((e) => e !== 'C' && e !== 'H')] : order;
    const body = hill.map((e) => e + (counts.get(e) === 1 ? '' : counts.get(e))).join('');
    if (!charge) return body;
    return body + (Math.abs(charge) === 1 ? '' : Math.abs(charge)) + (charge > 0 ? '+' : '−');
}

export interface MoleculeProperties {
    formula: string;
    /** Average molecular weight, g/mol. */
    mw: number;
    heavyAtoms: number;
    rings: number;
    hbd: number;
    hba: number;
    /** Topological polar surface area, Å². */
    tpsa: number;
    logP: number;
}

/** A few common descriptors, or null if RDKit can't parse the SMILES. */
export function moleculeProperties(rdkit: RDKitModule, smiles: string): MoleculeProperties | null {
    const mol = smiles ? rdkit.get_mol(smiles) : null;
    if (!mol) return null;
    try {
        if (!mol.is_valid()) return null;
        const d = JSON.parse(mol.get_descriptors());
        return {
            formula: formulaFromJson(mol.get_json()),
            mw: d.amw,
            heavyAtoms: d.NumHeavyAtoms,
            rings: d.NumRings,
            hbd: d.NumHBD,
            hba: d.NumHBA,
            tpsa: d.tpsa,
            logP: d.CrippenClogP,
        };
    } catch {
        return null;
    } finally {
        mol.delete();
    }
}
