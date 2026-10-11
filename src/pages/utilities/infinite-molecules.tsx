import React from 'react';
import Admonition from '@theme/Admonition';
import { VizExplanation, VizPage } from '../../components/shared/viz';
import { EveryMolecule } from '../../components/SelfiesGenerator/EveryMolecule';

export default function InfiniteMoleculesPage(): React.JSX.Element {
  return (
    <VizPage
      titleInPlot
      title="Infinite molecules"
      description="Scroll through every molecule a SELFIES string can describe, each with its own address"
    >
      <EveryMolecule title="Infinite molecules" />

      <VizExplanation
        aside={
          <>
            <Admonition type="tip" title="Try this">
              Find benzene (<code>c1ccccc1</code>) and see how far into the 8-symbol block it lives, or turn on{' '}
              <em>Keep going</em> and go to length 100.
            </Admonition>
            <Admonition type="note" title="What's left out">
              Only the symbols SELFIES treats as always valid: no stereochemistry, no explicit hydrogens, no metals, one
              molecule per string. You pick the atoms; charged forms are off by default because they're most of the
              full alphabet and most of the page. Smaller alphabets thin out faster, so their exact listing stops
              sooner.
            </Admonition>
          </>
        }
      >
        <h2>Numbering chemical space</h2>
        <p>
          SELFIES write a molecule as a string of symbols such as <code>[C]</code>, <code>[=O]</code>,{' '}
          <code>[Branch1]</code> or <code>[Ring1]</code>, and the grammar is built so that <em>any</em> string decodes
          to a valid molecule. So with an alphabet of N symbols, every number names a molecule: write it in base N and
          read off the symbols. The strings are shuffled with an invertible permutation (the same trick as{' '}
          <a href="https://everyuuid.com">everyuuid.com</a>), so neighbours look unrelated and any molecule's address
          can be worked out backwards.
        </p>
        <p>
          The catch is that most strings are the same molecule written differently, or have symbols that do nothing.
          With all 69 symbols, about 95% of 3-symbol strings are repeats. So the page only shows a string if it is the
          one SELFIES that RDKit's canonical SMILES encodes to, which makes every molecule appear exactly once without
          ever listing them all.
        </p>
        <p>
          That gets sparse quickly (around 1 string in 1,000 at 6 symbols), so past the cap the page stops checking and
          grows each molecule from its address instead: one atom, ring or branch at a time, keeping only steps that
          change the molecule. Those can be as long as you like. Repeats are possible in principle; I haven't seen one.
        </p>
      </VizExplanation>
    </VizPage>
  );
}
