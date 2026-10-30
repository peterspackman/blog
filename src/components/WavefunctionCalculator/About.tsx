import React, { useEffect, useRef, useState } from 'react';
import { VizButton } from '../shared/controls';
import styles from './About.module.css';

const DOI = 'https://doi.org/10.21105/joss.09609';

/** Browser facts that decide how fast occ runs; read after mount so the static render matches. */
function useRuntimeInfo() {
    const [info, setInfo] = useState<{ isolated: boolean; cores: number } | null>(null);
    useEffect(() => {
        setInfo({ isolated: !!globalThis.crossOriginIsolated, cores: navigator.hardwareConcurrency || 1 });
    }, []);
    return info;
}

/** What runs where, privacy, versions and how to cite, in a modal dialog. */
export function AboutDialog({ open, onClose, occVersion }: { open: boolean; onClose: () => void; occVersion?: string }) {
    const ref = useRef<HTMLDialogElement>(null);
    const runtime = useRuntimeInfo();

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open]);

    return (
        <dialog
            ref={ref}
            className={styles.dialog}
            onClose={onClose}
            onClick={(e) => {
                // A click on the backdrop lands on the dialog element itself.
                if (e.target === e.currentTarget) onClose();
            }}
            aria-labelledby="wfn-about-title"
        >
            <div className={styles.body}>
                <div className={styles.header}>
                    <h2 id="wfn-about-title">About this calculator</h2>
                    <VizButton size="sm" variant="ghost" onClick={onClose} aria-label="Close">
                        ✕
                    </VizButton>
                </div>

                <p>
                    Everything runs on your machine. <a href="https://getocc.xyz">OCC</a>, compiled to WebAssembly, does the quantum chemistry in
                    Web Workers; nothing you enter is uploaded. The only network request is the optional PubChem lookup, which goes straight to{' '}
                    <a href="https://pubchem.ncbi.nlm.nih.gov/">PubChem</a>.
                </p>
                <p>
                    A run solves the SCF equations (or GFN2-xTB&rsquo;s tight-binding equivalent) for the method you pick, and can optimise the
                    geometry and compute harmonic frequencies. Orbitals, densities and the electrostatic potential are evaluated by OCC on grids
                    or isosurfaces around the molecule and drawn in the browser. The 3D view and task handling come from the{' '}
                    <a href="https://github.com/peterspackman/cenext">CrystalExplorer</a> packages.
                </p>
                <p>Keep molecules small: the cost grows steeply with the number of basis functions. GFN2-xTB copes with larger ones.</p>

                <dl className={styles.facts}>
                    <dt>OCC</dt>
                    <dd>{occVersion ? `v${occVersion}` : 'unknown version'}</dd>
                    <dt>Threads</dt>
                    <dd>
                        {runtime === null
                            ? '…'
                            : runtime.isolated
                              ? `up to ${Math.max(1, runtime.cores - 1)} of ${runtime.cores} cores`
                              : 'unavailable: this page is not cross-origin isolated, so calculations may not run'}
                    </dd>
                </dl>

                <h3>Citing</h3>
                <p>If you use this in your work, please cite OCC:</p>
                <blockquote className={styles.citation}>
                    Spackman, P. R. (2026). Open Computational Chemistry (OCC) – A portable software library and program for quantum chemistry and
                    crystallography. <em>Journal of Open Source Software</em>, 11(117), 9609. <a href={DOI}>doi:10.21105/joss.09609</a>
                </blockquote>
            </div>
        </dialog>
    );
}

/** One line under the tool: where it runs, privacy, and the citation. */
export function CreditLine({ occVersion, onAbout }: { occVersion?: string; onAbout: () => void }) {
    return (
        <p className={styles.credit}>
            Computed in your browser with <a href="https://getocc.xyz">OCC</a>
            {occVersion ? ` v${occVersion}` : ''}. Nothing is uploaded. If you use it, please{' '}
            <a href={DOI}>cite OCC</a>.{' '}
            <button type="button" className={styles.linkButton} onClick={onAbout}>
                About
            </button>
        </p>
    );
}
