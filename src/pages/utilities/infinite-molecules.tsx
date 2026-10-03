import React from 'react';
import Admonition from '@theme/Admonition';
import { VizExplanation, VizPage } from '../../components/shared/viz';
import { InfiniteMolecules } from '../../components/SelfiesGenerator/InfiniteMolecules';

export default function InfiniteMoleculesPage(): React.JSX.Element {
  return (
    <VizPage
      title="Infinite molecules"
      description="Page through every molecule that a short SELFIES string can describe"
      intro="Every string of SELFIES symbols is a valid molecule, so chemical space can be numbered and paged through like a book. Click a SELFIES or SMILES string to copy it."
    >
      <InfiniteMolecules />

      <VizExplanation
        aside={
          <>
            <Admonition type="tip" title="Try this">
              Step through the first few pages of 2-symbol strings: the first symbol changes fastest, so each
              page walks one atom or bond type through the alphabet.
            </Admonition>
            <Admonition type="note" title="Duplicates">
              Different strings can decode to the same molecule, and branch or ring symbols with nothing to act on
              are dropped, so the count is of strings, not distinct molecules.
            </Admonition>
          </>
        }
      >
        <h2>Numbering chemical space</h2>
        <p>
          SELFIES (self-referencing embedded strings) write a molecule as a sequence of symbols such as{' '}
          <code>[C]</code>, <code>[=O]</code>, <code>[Branch1]</code> or <code>[Ring1]</code>. Unlike SMILES, the
          grammar is built so that <em>any</em> sequence of symbols decodes to a valid molecule: a bond that would
          exceed an atom's valence is reduced, and a ring or branch that can't be formed is skipped.
        </p>
        <p>
          That makes enumeration easy. With an alphabet of N symbols there are N<sup>M</sup> strings of length M;
          write the index in base N and read each digit as a symbol. Each string is decoded to SMILES and drawn
          with RDKit, all in your browser.
        </p>
      </VizExplanation>
    </VizPage>
  );
}
