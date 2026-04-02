/**
 * PubChem REST API utilities for fetching 3D molecular structures.
 */

function sdfToXyz(sdf: string): string {
    const lines = sdf.split('\n');

    const countsLineIdx = 3;
    const countsLine = lines[countsLineIdx];
    const numAtoms = parseInt(countsLine.substring(0, 3).trim());

    if (isNaN(numAtoms) || numAtoms <= 0) {
        throw new Error('Invalid SDF format: could not parse atom count');
    }

    const atoms: { symbol: string; x: number; y: number; z: number }[] = [];

    for (let i = 0; i < numAtoms; i++) {
        const line = lines[countsLineIdx + 1 + i];
        if (!line) continue;

        const x = parseFloat(line.substring(0, 10).trim());
        const y = parseFloat(line.substring(10, 20).trim());
        const z = parseFloat(line.substring(20, 30).trim());
        const symbol = line.substring(31, 34).trim();

        if (!isNaN(x) && !isNaN(y) && !isNaN(z) && symbol) {
            atoms.push({ symbol, x, y, z });
        }
    }

    if (atoms.length === 0) {
        throw new Error('No atoms found in SDF file');
    }

    let xyz = `${atoms.length}\nFrom PubChem\n`;
    for (const atom of atoms) {
        xyz += `${atom.symbol}    ${atom.x.toFixed(6)}    ${atom.y.toFixed(6)}    ${atom.z.toFixed(6)}\n`;
    }
    return xyz;
}

/**
 * Fetch a 3D molecular structure from PubChem by compound name.
 * Returns XYZ format string.
 */
export async function fetchFromPubChem(name: string): Promise<string> {
    const searchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/cids/JSON`;
    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
        throw new Error(`Compound "${name}" not found on PubChem`);
    }

    const searchData = await searchResponse.json();
    const cid = searchData.IdentifierList?.CID?.[0];

    if (!cid) {
        throw new Error(`Could not find CID for "${name}"`);
    }

    const sdfUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`;
    const sdfResponse = await fetch(sdfUrl);

    if (!sdfResponse.ok) {
        throw new Error(`3D structure not available for "${name}"`);
    }

    const sdf = await sdfResponse.text();
    return sdfToXyz(sdf);
}
