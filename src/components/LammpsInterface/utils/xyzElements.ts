const SYMBOLS = new Set(
    ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr ' +
        'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb ' +
        'Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr ' +
        'Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' '),
);

export function isElementSymbol(label: string): boolean {
    return SYMBOLS.has(label);
}

export interface LabelledXYZ {
    /** The trajectory with numeric type labels replaced where a mapping exists. */
    text: string;
    /** Whether every atom label is an element symbol. */
    allElements: boolean;
}

/**
 * LAMMPS xyz dumps label atoms by numeric type unless `dump_modify element`
 * is used. Replace numeric labels using the type -> element mapping, and
 * report whether the result names real elements throughout.
 */
export function labelXYZ(text: string, mapping?: Map<number, string>): LabelledXYZ {
    const lines = text.split('\n');
    let allElements = true;
    let i = 0;
    while (i < lines.length) {
        const n = parseInt(lines[i].trim(), 10);
        if (!Number.isFinite(n) || n <= 0) {
            i++;
            continue;
        }
        for (let k = i + 2; k < Math.min(i + 2 + n, lines.length); k++) {
            const match = lines[k].match(/^(\s*)(\S+)(.*)$/);
            if (!match) continue;
            let label = match[2];
            if (/^\d+$/.test(label)) {
                const element = mapping?.get(parseInt(label, 10))?.trim();
                if (element) {
                    label = element;
                    lines[k] = match[1] + label + match[3];
                }
            }
            if (!isElementSymbol(label)) allElements = false;
        }
        i += n + 2;
    }
    return { text: lines.join('\n'), allElements };
}

/** True when the script uses LAMMPS reduced (Lennard-Jones) units. */
export function usesReducedUnits(script: string): boolean {
    return /^\s*units\s+lj\b/m.test(script);
}
