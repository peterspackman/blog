import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Select, VizButton } from '../../shared/controls';
import { VizPanel } from '../../shared/viz';
import { EXAMPLE_MOLECULES } from '../examples';
import { parseMolecule, type Molecule } from '../molecule';
import { fetchPubChemSdf } from '../pubchem';
import styles from '../WavefunctionCalculator.module.css';

/** Above this the default basis gets slow in the browser. */
const LARGE_MOLECULE_ATOMS = 40;

interface MoleculePanelProps {
    molecule: Molecule | null;
    onMolecule: (molecule: Molecule | null) => void;
    disabled: boolean;
}

export function MoleculePanel({ molecule, onMolecule, disabled }: MoleculePanelProps) {
    const [text, setText] = useState(molecule?.source ?? EXAMPLE_MOLECULES[0].xyz);
    const [filename, setFilename] = useState<string | undefined>();
    const [parseError, setParseError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);

    // Parse after typing pauses; a file or example applies at once.
    useEffect(() => {
        const timer = setTimeout(() => {
            try {
                onMolecule(parseMolecule(text, filename));
                setParseError(null);
            } catch (e) {
                onMolecule(null);
                setParseError(e instanceof Error ? e.message : String(e));
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [text, filename, onMolecule]);

    const load = (content: string, name?: string) => {
        setFilename(name);
        setText(content);
    };

    const readFile = async (file: File) => load(await file.text(), file.name);

    const searchPubChem = async () => {
        setSearching(true);
        setSearchError(null);
        try {
            load(await fetchPubChemSdf(query), `${query.trim()}.sdf`);
        } catch (e) {
            setSearchError(e instanceof Error ? e.message : String(e));
        } finally {
            setSearching(false);
        }
    };

    return (
        <VizPanel title="Molecule" stack>
            <Select
                label="Example"
                value=""
                onChange={(id) => {
                    const example = EXAMPLE_MOLECULES.find((m) => m.id === id);
                    if (example) load(example.xyz);
                }}
                options={[{ value: '', label: 'Choose an example…', disabled: true }, ...EXAMPLE_MOLECULES.map((m) => ({ value: m.id, label: m.name }))]}
                disabled={disabled}
            />

            <form
                className={styles.inlineForm}
                onSubmit={(e) => {
                    e.preventDefault();
                    void searchPubChem();
                }}
            >
                <input
                    className={styles.textInput}
                    placeholder="Search PubChem, e.g. benzene"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={disabled || searching}
                    aria-label="PubChem compound name"
                />
                <VizButton type="submit" size="sm" disabled={disabled || searching || !query.trim()}>
                    {searching ? 'Searching…' : 'Fetch'}
                </VizButton>
            </form>
            {searchError && <p className={styles.error}>{searchError}</p>}

            <div
                className={clsx(styles.dropZone, dragging && styles.dropZoneActive)}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file && !disabled) void readFile(file);
                }}
            >
                <textarea
                    className={styles.geometry}
                    value={text}
                    onChange={(e) => load(e.target.value)}
                    spellCheck={false}
                    disabled={disabled}
                    aria-label="Geometry (XYZ or SDF)"
                    rows={8}
                />
                <div className={styles.dropHint}>
                    XYZ or SDF · drop a file or{' '}
                    <button type="button" className={styles.linkButton} onClick={() => fileInput.current?.click()} disabled={disabled}>
                        browse
                    </button>
                </div>
                <input
                    ref={fileInput}
                    type="file"
                    accept=".xyz,.sdf,.mol"
                    hidden
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void readFile(file);
                        e.target.value = '';
                    }}
                />
            </div>

            {parseError ? (
                <p className={styles.error}>{parseError}</p>
            ) : molecule ? (
                <p className={styles.meta}>
                    <strong>{molecule.formula}</strong> · {molecule.data.atoms.length} atoms · {molecule.nuclearCharge} electrons when neutral
                    {molecule.data.atoms.length > LARGE_MOLECULE_ATOMS && (
                        <span className={styles.warning}> · large for the browser: try GFN2-xTB or a small basis</span>
                    )}
                </p>
            ) : null}
        </VizPanel>
    );
}
