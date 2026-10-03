import React, { useDeferredValue, useMemo, useState } from 'react';
import { useVizTheme, VizPanel, VizPanelSection, VizSectionHeader, VizWorkbench } from '../shared/viz';
import { ControlGroup, ControlHint, SegmentedControl } from '../shared/controls';
import { moleculeProperties, moleculeSvg, useRDKit } from '../shared/chem';
import styles from './SmilesViewer.module.css';

const EXAMPLES = [
  { name: 'Aspirin', smiles: 'CC(=O)Oc1ccccc1C(=O)O' },
  { name: 'Caffeine', smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C' },
  { name: 'Glucose', smiles: 'C([C@@H]1[C@H]([C@@H]([C@H](C(O1)O)O)O)O)O' },
  { name: 'Ibuprofen', smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O' },
  { name: 'Penicillin G', smiles: 'CC1(C)S[C@@H]2[C@H](NC(=O)Cc3ccccc3)C(=O)N2[C@H]1C(=O)O' },
  { name: 'Vitamin C', smiles: 'C([C@@H]([C@@H]1C(=C(C(=O)O1)O)O)O)O' },
];

/** C9H8O4 → C₉H₈O₄ with a superscript charge. */
function Formula({ formula }: { formula: string }) {
  const m = /^(.*?)(\d*[+−])?$/.exec(formula)!;
  return (
    <>
      {m[1].split(/(\d+)/).map((part, i) => (i % 2 ? <sub key={i}>{part}</sub> : part))}
      {m[2] && <sup>{m[2]}</sup>}
    </>
  );
}

export function SmilesViewer() {
  const theme = useVizTheme();
  const { rdkit, error: loadError } = useRDKit();
  const [smiles, setSmiles] = useState(EXAMPLES[0].smiles);
  const input = useDeferredValue(smiles.trim());

  const svg = useMemo(() => (rdkit ? moleculeSvg(rdkit, input, theme, { width: 520, height: 400 }) : null), [rdkit, input, theme]);
  const props = useMemo(() => (rdkit ? moleculeProperties(rdkit, input) : null), [rdkit, input]);
  const invalid = Boolean(rdkit && input && !svg);
  const example = EXAMPLES.find((e) => e.smiles === smiles.trim())?.name ?? '';

  const sidebar = (
    <VizPanel stack>
      <ControlGroup label="SMILES">
        <textarea
          className={styles.textarea}
          value={smiles}
          onChange={(e) => setSmiles(e.target.value)}
          placeholder="e.g. CC(=O)O for acetic acid"
          rows={3}
          spellCheck={false}
          aria-label="SMILES string"
          aria-invalid={invalid}
        />
        {invalid ? (
          <p className={styles.error}>RDKit can't parse this SMILES string.</p>
        ) : (
          <ControlHint>The structure updates as you type.</ControlHint>
        )}
      </ControlGroup>
      <ControlGroup label="Examples">
        <SegmentedControl<string>
          aria-label="Example molecules"
          columns={2}
          value={example}
          onChange={(name) => setSmiles(EXAMPLES.find((e) => e.name === name)!.smiles)}
          options={EXAMPLES.map((e) => ({ value: e.name, label: e.name }))}
        />
      </ControlGroup>
    </VizPanel>
  );

  let body: React.ReactNode;
  if (loadError) body = <p className={styles.placeholder}>{loadError}. Check your connection and reload.</p>;
  else if (!rdkit) body = <p className={styles.placeholder}>Loading RDKit…</p>;
  else if (svg) body = <div className={styles.molecule} dangerouslySetInnerHTML={{ __html: svg }} />;
  else body = <p className={styles.placeholder}>{input ? 'No structure to show.' : 'Enter a SMILES string to draw it.'}</p>;

  return (
    <VizWorkbench sidebar={sidebar}>
      <VizPanel flush>
        <VizPanelSection>
          <VizSectionHeader title={example || 'Structure'} detail={props && <Formula formula={props.formula} />} />
          <div className={styles.stage}>{body}</div>
        </VizPanelSection>
        {props && svg && (
          <VizPanelSection>
            <dl className={styles.properties}>
              <div><dt>Formula</dt><dd><Formula formula={props.formula} /></dd></div>
              <div><dt>Mass</dt><dd>{props.mw.toFixed(2)} g/mol</dd></div>
              <div><dt>Heavy atoms</dt><dd>{props.heavyAtoms}</dd></div>
              <div><dt>Rings</dt><dd>{props.rings}</dd></div>
              <div><dt>H-bond donors</dt><dd>{props.hbd}</dd></div>
              <div><dt>H-bond acceptors</dt><dd>{props.hba}</dd></div>
              <div><dt>TPSA</dt><dd>{props.tpsa.toFixed(1)} Å²</dd></div>
              <div><dt>cLogP</dt><dd>{props.logP.toFixed(2)}</dd></div>
            </dl>
          </VizPanelSection>
        )}
      </VizPanel>
    </VizWorkbench>
  );
}
