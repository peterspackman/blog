import React, { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import TrajectoryViewer from '@site/src/components/TrajectoryViewer';
import styles from '@site/src/components/TrajectoryViewer/TrajectoryPage.module.css';
import { VizPage, VizPanel, VizWorkbench } from '@site/src/components/shared/viz';
import {
  ButtonRow,
  CollapsibleSection,
  ControlGroup,
  ControlHint,
  SegmentedControl,
  VizButton,
} from '@site/src/components/shared/controls';

type Source = 'xyz' | 'files';

// Water geometry optimisation, with energies in the comment lines.
const EXAMPLE_TRAJECTORY = `3
Step 0 Energy=-75.576566960
O     0.000000     0.000000     0.000000
H     0.900000     0.000000     0.000000
H    -0.300000     0.850000     0.000000
3
Step 1 Energy=-75.584772914
O    -0.007706    -0.010230     0.000000
H     0.934579    -0.016478     0.000000
H    -0.326873     0.876708     0.000000
3
Step 2 Energy=-75.585838726
O    -0.014077    -0.019071     0.000000
H     0.946513    -0.018211     0.000000
H    -0.332435     0.887282     0.000000
3
Step 3 Energy=-75.585944869
O    -0.017729    -0.024187     0.000000
H     0.948447    -0.015719     0.000000
H    -0.330718     0.889906     0.000000
3
Step 4 Energy=-75.585957726
O    -0.019253    -0.026339     0.000000
H     0.947775    -0.013628     0.000000
H    -0.328522     0.889966     0.000000
3
Step 5 Energy=-75.585959662
O    -0.019726    -0.027015     0.000000
H     0.947039    -0.012603     0.000000
H    -0.327313     0.889618     0.000000
3
Step 6 Energy=-75.585959757
O    -0.019728    -0.027022     0.000000
H     0.946851    -0.012467     0.000000
H    -0.327123     0.889489     0.000000`;

const FORMAT_EXAMPLE = `3
Frame 1
O  0.000  0.000  0.000
H  0.757  0.586  0.000
H -0.757  0.586  0.000
3
Frame 2
O  0.000  0.000  0.010
...`;

/** Returns an error message, or '' if the text parses as at least one XYZ frame. */
function validateXYZ(text: string): string {
  if (!text.trim()) return '';
  const lines = text.trim().split('\n');
  let frames = 0;
  let i = 0;
  while (i < lines.length) {
    const numAtoms = parseInt(lines[i]);
    if (isNaN(numAtoms)) {
      i++;
      continue;
    }
    if (i + numAtoms + 1 >= lines.length) {
      return `Frame ${frames + 1} is incomplete: expected ${numAtoms} atoms but reached the end of the file.`;
    }
    frames++;
    i += numAtoms + 2;
  }
  return frames === 0 ? 'No XYZ frames found.' : '';
}

/** Button plus drag-and-drop target for a single file. */
function FileDrop({
  label,
  accept,
  file,
  onFile,
  children,
}: {
  label: string;
  accept: string;
  file?: File | null;
  onFile: (file: File) => void;
  children?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={clsx(styles.drop, over && styles.dropOver)}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
      <VizButton size="sm" onClick={() => inputRef.current?.click()}>
        {label}
      </VizButton>
      <span className={styles.dropHint}>{file ? <span className={styles.fileName}>{file.name}</span> : 'or drop a file here'}</span>
      {children}
    </div>
  );
}

export default function XYZTrajectoryViewer(): React.JSX.Element {
  const [source, setSource] = useState<Source>('xyz');
  const [trajectoryText, setTrajectoryText] = useState('');
  const [readError, setReadError] = useState('');
  const [structureFile, setStructureFile] = useState<File | null>(null);
  const [trajectoryFile, setTrajectoryFile] = useState<File | null>(null);

  const parseError = useMemo(() => validateXYZ(trajectoryText), [trajectoryText]);
  const error = readError || parseError;

  const loadText = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setReadError('');
      setTrajectoryText((e.target?.result as string) ?? '');
    };
    reader.onerror = () => setReadError('Could not read the file.');
    reader.readAsText(file);
  };

  const sidebar = (
    <VizPanel stack>
      <SegmentedControl<Source>
        aria-label="Input"
        value={source}
        onChange={setSource}
        options={[
          { value: 'xyz', label: 'XYZ text' },
          { value: 'files', label: 'Structure files' },
        ]}
      />

      {source === 'xyz' ? (
        <>
          <ControlGroup label="Multi-frame XYZ">
            <FileDrop label="Open file" accept=".xyz,.extxyz,.txt" onFile={loadText} />
            <textarea
              className={styles.textarea}
              value={trajectoryText}
              onChange={(e) => {
                setReadError('');
                setTrajectoryText(e.target.value);
              }}
              placeholder="Paste multi-frame XYZ here"
              spellCheck={false}
              aria-label="XYZ trajectory"
            />
            <ButtonRow>
              <VizButton size="sm" onClick={() => setTrajectoryText(EXAMPLE_TRAJECTORY)}>
                Example
              </VizButton>
              <VizButton size="sm" variant="ghost" onClick={() => setTrajectoryText('')} disabled={!trajectoryText}>
                Clear
              </VizButton>
            </ButtonRow>
            {error && <p className={styles.error}>{error}</p>}
          </ControlGroup>
          <CollapsibleSection title="Format">
            <ControlHint>Each frame is an atom count, a comment line, then one line per atom.</ControlHint>
            <pre className={styles.formatExample}>{FORMAT_EXAMPLE}</pre>
            <ControlHint>
              Extended XYZ comments are read too: <code>Energy=</code> is shown relative to the lowest frame, and{' '}
              <code>Lattice="…"</code> enables the unit cell and supercells.
            </ControlHint>
          </CollapsibleSection>
        </>
      ) : (
        <>
          <ControlGroup label="Structure (required)">
            <FileDrop
              label="Choose structure"
              accept=".pdb,.ent,.pqr,.gro,.mmcif,.cif,.mcif,.sdf,.mol2,.mmtf"
              file={structureFile}
              onFile={setStructureFile}
            />
            <ControlHint>PDB, GRO, mmCIF, SDF, MOL2 or MMTF.</ControlHint>
          </ControlGroup>
          <ControlGroup label="Trajectory (optional)">
            <FileDrop label="Choose trajectory" accept=".dcd,.trr,.xtc,.nctraj" file={trajectoryFile} onFile={setTrajectoryFile} />
            <ControlHint>DCD, TRR, XTC or NCTRAJ. Leave empty to play the models of a multi-model structure.</ControlHint>
          </ControlGroup>
          <VizButton
            size="sm"
            variant="ghost"
            disabled={!structureFile && !trajectoryFile}
            onClick={() => {
              setStructureFile(null);
              setTrajectoryFile(null);
            }}
          >
            Clear files
          </VizButton>
        </>
      )}
    </VizPanel>
  );

  let viewer: React.ReactNode;
  if (source === 'xyz' && trajectoryText.trim() && !error) {
    viewer = <TrajectoryViewer trajectoryData={trajectoryText} moleculeName="XYZ trajectory" autoPlay={false} />;
  } else if (source === 'files' && structureFile) {
    viewer = (
      <TrajectoryViewer
        structureFile={structureFile}
        trajectoryFile={trajectoryFile ?? undefined}
        moleculeName={structureFile.name.split('.')[0]}
        autoPlay={false}
      />
    );
  } else {
    viewer = (
      <VizPanel className={styles.placeholder}>
        <div className={styles.placeholderContent}>
          {source === 'xyz' ? (
            <>
              <p>Paste or open a multi-frame XYZ file to play it back.</p>
              <VizButton variant="primary" onClick={() => setTrajectoryText(EXAMPLE_TRAJECTORY)}>
                Load the example
              </VizButton>
            </>
          ) : (
            <p>Choose a structure file, and optionally a trajectory, to play it back.</p>
          )}
        </div>
      </VizPanel>
    );
  }

  return (
    <VizPage
      title="Trajectory viewer"
      description="Play back molecular trajectories from XYZ data or structure and trajectory files"
      intro="Play back geometry optimisations and dynamics from multi-frame XYZ, or from a structure plus trajectory file. Everything runs in your browser using NGL."
    >
      <VizWorkbench sidebar={sidebar}>
        <div className={styles.stage}>{viewer}</div>
      </VizWorkbench>
    </VizPage>
  );
}
