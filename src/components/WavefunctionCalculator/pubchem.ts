const PUG = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound';

/** A compound's 3D structure from PubChem, by name, as SDF text. */
export async function fetchPubChemSdf(name: string): Promise<string> {
    const query = name.trim();
    if (!query) throw new Error('Enter a compound name');
    const search = await fetch(`${PUG}/name/${encodeURIComponent(query)}/cids/JSON`);
    if (!search.ok) throw new Error(`"${query}" was not found on PubChem`);
    const cid = (await search.json()).IdentifierList?.CID?.[0];
    if (!cid) throw new Error(`PubChem returned no compound for "${query}"`);
    const sdf = await fetch(`${PUG}/cid/${cid}/SDF?record_type=3d`);
    if (!sdf.ok) throw new Error(`PubChem has no 3D structure for "${query}"`);
    return sdf.text();
}
