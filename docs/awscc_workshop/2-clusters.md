---
sidebar_position: 3
---

import Figure from '@site/src/components/Figure';
import { Tutorial, Step, Instructions, Commands, Output, Notes } from '@site/src/components/HandsOnExample';

# 2. From Pairs to Crystals: Many-Body Effects

Moving from isolated pairs to clusters and crystals reveals fundamental challenges in computational chemistry. The total energy is not simply the sum of pairwise interactions. This section explores how to calculate lattice energies using the `occ elat` command and estimate energies with fast semi-empirical methods like xTB.

## The Many-Body Problem

### Why Pairs Don't Tell the Whole Story

Consider three water molecules A, B, and C. The total interaction energy is:

<div style={{textAlign: 'center'}}>

$$E_{ABC} = E_{AB} + E_{AC} + E_{BC} + \Delta E_{3-body}$$

</div>

where $\Delta E_{3-body}$ is the non-additive three-body term. This arises from:

1. **Polarization effects**: A polarizes B, which affects how B interacts with C
2. **Charge transfer**: Electron density redistributes across all three molecules
3. **Exchange repulsion**: Overlapping electron clouds of all three molecules

### Energy Hierarchy in Clusters

For a cluster of N molecules, the many-body expansion is:

<div style={{textAlign: 'center'}}>

$$E_{total} = \sum_{i<j} E_{ij}^{(2)} + \sum_{i<j<k} E_{ijk}^{(3)} + \sum_{i<j<k<l} E_{ijkl}^{(4)} + ...$$

</div>

Where:
- $E_{ij}^{(2)}$ = pairwise interactions (typically 85-95% of total)
- $E_{ijk}^{(3)}$ = three-body corrections (5-15%)
- Higher terms usually < 1%

### Physical Origins of Many-Body Effects

The breakdown of pairwise additivity occurs because molecular environments are not independent. When molecule A interacts with molecule B, it changes how A can subsequently interact with molecule C. This leads to several physical effects:

**1. Cooperative Effects (Negative 3-body terms)**
- **Polarization enhancement**: A polarizes B, making B a better hydrogen bond partner for C
- **Charge transfer cascades**: Electrons flow A→B→C, strengthening all interactions
- **Common in**: π-stacking, metal coordination, extended conjugated systems

**2. Anti-cooperative Effects (Positive 3-body terms)**  
- **Polarization saturation**: A polarizes B, leaving B less able to interact with C
- **Electrostatic screening**: Charges reorganize to minimize unfavorable interactions
- **Common in**: Hydrogen bonding networks, ionic solutions

**3. Mixed Effects**
- **Real systems** often show both types depending on geometry and chemical environment
- **Water clusters** typically show weak anti-cooperativity (~5% of binding)
- **Overall magnitude** determines whether pairwise models are adequate

The key insight is that **many-body effects are not just corrections - they reveal fundamental physics** about how molecular interactions depend on chemical environment.

### The Crystal Challenge

<Figure 
  src="/img/awscc_workshop/pbc.png" 
  alt="Periodic boundary conditions in crystals" 
  caption="Infinite crystal represented by periodic unit cells"
  width="300px"
  float="right"
/>

In a crystal, we face additional complexity:

1. **Infinite interactions**: Each molecule interacts with infinite neighbors
2. **Long-range electrostatics**: Decay as $r^{-1}$, requiring special summation techniques
3. **Periodic boundary conditions**: The unit cell represents infinite repetition

The lattice energy is:
<div style={{textAlign: 'center'}}>

$$E_{lattice} = \frac{1}{2} \sum_{i=1}^{N} \sum_{j \neq i}^{\infty} E_{ij}$$

</div>

The factor of 1/2 avoids double counting. The sum converges because:
- Electrostatic: Conditionally convergent (depends on summation order)
- Dispersion: Converges as $r^{-6}$
- Total molecules within sphere of radius R: $\propto R^3$
- Total dispersion energy: $\propto R^3 \times r^{-6} = R^{-3}$ → converges

## Computational Exercises

The exercises below demonstrate the concepts outlined above using real calculations. We'll progress from small clusters (where we can calculate everything exactly) to larger systems (where approximations become necessary) to infinite crystals (where pairwise models excel).

### Exercise 1: Many-Body Effects in Water Trimers

This exercise quantifies the breakdown of pairwise additivity for a realistic water trimer extracted from ice crystal structure. We'll calculate all the individual components of the many-body expansion to see how significant three-body effects really are.

<Tutorial
  title="Many-Body Effects in Water Trimers"
  description="Calculate three-body contributions to water trimer interaction energy to understand the limitations of pairwise additivity."
>
  <Step id="setup" title="Navigate to water trimers directory">
    <Instructions>
      <p>Navigate to the water trimers directory and examine the molecular structures extracted from ice crystal.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`cd awscc_workshop_2025/02_pairwise_sums/water_trimers/
ls -la *.xyz
echo "---"
echo "Number of atoms in each file:"
wc -l *.xyz | grep -v total`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`A.xyz  B.xyz  C.xyz  AB.xyz  AC.xyz  BC.xyz  ABC.xyz
---
Number of atoms in each file:
   3 A.xyz
   3 B.xyz  
   3 C.xyz
   6 AB.xyz
   6 AC.xyz
   6 BC.xyz
   9 ABC.xyz`}</code></pre>
    </Output>
    
    <Notes>
      <p>We have 3 monomers (A, B, C), 3 dimers (AB, AC, BC), and 1 trimer (ABC) from ice structure.</p>
    </Notes>
  </Step>

  <Step id="examine_geometry" title="Visualize the trimer structure">
    <Instructions>
      <p>Look at the trimer geometry to understand the hydrogen bonding network.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`cat ABC.xyz`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`9
Water trimer A-B-C
O         -1.24182      2.15090      0.39756
H         -1.25772      2.17843      1.40308
H         -1.71973      2.97865      0.07604
O         -1.29031      2.23488      3.06844
H         -1.74403      1.40804      3.42039
H         -0.34738      2.21439      3.42039
O         -2.58061     -0.00000     -0.50304
H         -2.09141     -0.80635     -0.15110
H         -2.09141      0.80635     -0.15110`}</code></pre>
    </Output>
    
    <Notes>
      <p>The O-O distances are ~2.7 Å and ~2.6 Å for A-B and A-C pairs, but ~4.1 Å for B-C - not all pairs interact strongly.</p>
    </Notes>
  </Step>

  <Step id="run_calculation" title="Run trimer calculation">
    <Instructions>
      <p>Execute the script to calculate all monomer, dimer, and trimer energies.</p>
    </Instructions>
    
    <Commands>
      <pre><code>./run_water_trimer.sh --threads 2</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`=========================================
INTERACTION ENERGY ANALYSIS
=========================================

Individual pairwise interactions:
  E_int(A-B) = -0.016885 hartree = -44.33 kJ/mol
  E_int(A-C) = -0.015870 hartree = -41.67 kJ/mol
  E_int(B-C) = -0.001111 hartree = -2.92 kJ/mol

Trimer interaction energies:
  Direct trimer:     -0.038561 hartree = -101.24 kJ/mol
  Sum of pairs:      -0.033866 hartree = -88.92 kJ/mol
  Many-body effect:  -0.004695 hartree = -12.33 kJ/mol

Many-body contribution: 12.1% of total interaction`}</code></pre>
    </Output>
    
    <Notes>
      <p>The three-body effect is -12.33 kJ/mol, about 12% of the total interaction energy - cooperative binding beyond pairwise additivity. But this is just for hf/3-21g! Which we know suffers from BSSE... Let's do the same thing with a better method/basis </p>
    </Notes>
  </Step>

  <Step id="run_calculation" title="Run trimer calculation with wb97x/def2-tzvpp">
    <Instructions>
      <p>Execute the script to calculate all monomer, dimer, and trimer energies.</p>
    </Instructions>
    
    <Commands>
      <pre><code>./run_water_trimer.sh --method wb97x --basis def2-tzvpp</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`=========================================
INTERACTION ENERGY ANALYSIS
=========================================

Individual pairwise interactions:
  E_int(A-B) = -0.008928 hartree = -23.44 kJ/mol
  E_int(A-C) = -0.008402 hartree = -22.06 kJ/mol
  E_int(B-C) = -0.001432 hartree = -3.76 kJ/mol

Trimer interaction energies:
  Direct trimer:     -0.021519 hartree = -56.50 kJ/mol
  Sum of pairs:      -0.018762 hartree = -49.26 kJ/mol
  Many-body effect:  -0.002758 hartree = -7.24 kJ/mol

Many-body contribution: 12.8% of total interaction`}</code></pre>
    </Output>
    
    <Notes>
      <p>The three-body effect is smaller in terms of total energy (-7.24 kJ/mol),but still about 13% of the total interaction energy!</p>
    </Notes>
  </Step>


  <Step id="analyze_pairwise" title="Understand pairwise contributions">
    <Instructions>
      <p>Analyze why the B-C interaction is so weak compared to A-B and A-C.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`echo "Pairwise interaction analysis:"
echo "Pair   Distance   E_int (kJ/mol)   Comment"
echo "------------------------------------------------"
echo "A-B    2.67 Å        -23.44        Strong H-bond"
echo "A-C    2.59 Å        -22.06        Strong H-bond"  
echo "B-C    4.12 Å         -3.76        Weak/no H-bond"
echo ""
echo "Molecule A acts as a double hydrogen bond donor/acceptor"
echo "bridging between B and C, creating cooperativity."`}</code></pre>
    </Commands>
    
    <Notes>
      <p>The geometry shows A is the central molecule, hydrogen bonded to both B and C. Confirm this via a visualisation program!</p>
    </Notes>
  </Step>

  <Step id="implications" title="Implications for simulations">
    <Instructions>
      <p>Consider when many-body effects matter for molecular simulations.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`echo "When do many-body effects matter?"
echo "================================="
echo ""
echo "Small effects (~5%) for:"
echo "- Neutral molecules"
echo "- Van der Waals interactions"  
echo "- Simple hydrogen bonds"
echo ""
echo "Large effects (>10%) for:"
echo "- Ionic systems"
echo "- Metal coordination"
echo "- Conjugated π-systems"
echo "- Dense hydrogen bond networks"
echo ""
echo "For water: ~5% error is often acceptable, but"
echo "accumulates in bulk simulations (ice, liquid water)."`}</code></pre>
    </Commands>
    
    <Notes>
      <p>Many (most) force fields neglect 3-body terms for efficiency, accepting ~5% error in exchange for 100x speedup. but it's also worth keeping in mind that a trimer itself is not necessarily representative of a bulk structure! The 4, 5 ... n-body interactions may not be uniformly negative (binding)!</p>
    </Notes>
  </Step>
</Tutorial>

### Exercise 2: Convergence of Interaction Energy with Cluster Size

Moving from trimers to larger clusters, we need to understand how interaction energies converge with system size. This is crucial for simulation cutoffs and for understanding when finite cluster calculations approximate bulk behavior. We'll use fast semi-empirical xTB calculations to study clusters with dozens of molecules.

<Tutorial
  title="Ice Cluster Convergence Study"
  description="Calculate interaction energies for ice clusters with 4 and 8 neighbor shells to understand the range of intermolecular interactions."
>
  <Step id="setup" title="Navigate to ice clusters directory">
    <Instructions>
      <p>Navigate to the ice clusters directory and examine the pre-built cluster structures from ice crystal.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`cd ../ice_clusters/
ls -la *.xyz
echo "---"
echo "Number of water molecules in each file:"
for f in *.xyz; do echo "$f: $(head -1 $f) molecules"; done`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`ice_central_molecule.xyz  ice_cluster_4.xyz  ice_cluster_8.xyz  
ice_neighbors_4.xyz  ice_neighbors_8.xyz  ice_cluster_12.xyz  ice_cluster_16.xyz
---
Number of water molecules in each file:
ice_central_molecule.xyz: 3 molecules
ice_cluster_4.xyz: 15 molecules  
ice_cluster_8.xyz: 27 molecules
ice_neighbors_4.xyz: 12 molecules
ice_neighbors_8.xyz: 24 molecules
ice_cluster_12.xyz: 45 molecules
ice_cluster_16.xyz: 65 molecules`}</code></pre>
    </Output>
    
    <Notes>
      <p>Clusters are built with a central molecule plus neighbor shells. E_interaction = E_cluster - E_central - E_neighbors.</p>
    </Notes>
  </Step>

  <Step id="run_calculation" title="Run cluster calculations">
    <Instructions>
      <p>Execute xTB calculations on all cluster components using the GFN2 method.</p>
    </Instructions>
    
    <Commands>
      <pre><code>./run_ice_clusters.sh --method gfn2 --threads 2</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`=========================================
INTERACTION ENERGY ANALYSIS
=========================================

Total interaction energies:
  4-shell cluster:  -0.055711 hartree = -146.27 kJ/mol
  8-shell cluster:  -0.049212 hartree = -129.21 kJ/mol

Per-molecule interaction energies:
  4-shell cluster:  -0.011142 hartree = -29.25 kJ/mol per molecule
  8-shell cluster:  -0.005468 hartree = -14.36 kJ/mol per molecule

Convergence: -13.2% change from 4 to 8 shells`}</code></pre>
    </Output>
    
    <Notes>
      <p>The total binding energy for the central molecule decreases! When going from 4 Å to 8 Å neighbor shells, showing long-range effects matter. Larger cluster calculations may require significant computational resources and memory optimization.</p>
    </Notes>
  </Step>

</Tutorial>

## Understanding Energy Units in Crystals

:::warning[Critical Concept]
Always specify what your energy is **per unit of**. This is one of the most common sources of error in computational crystal studies!
:::

### Different Ways to Report Crystal Energies

- **Per molecule**: Energy to remove one molecule from crystal
- **Per unit cell**: Energy for the entire repeating unit  
- **Per asymmetric unit**: Energy for symmetry-unique part
- **Per formula unit**: Energy for the simplest stoichiometric unit
- **Per atom**: Often used in benchmarking studies for fair comparison

### Common Mistakes and How to Avoid Them

**Example 1: Ice vs. Salt**
- Ice: H₂O → 1 molecule per formula unit
- NaCl: Na⁺ + Cl⁻ → 2 ions per formula unit  
- Comparing "-800 kJ/mol" for NaCl vs "-63 kJ/mol" for ice is meaningless!
- Must compare: NaCl (-400 kJ/mol per ion) vs H₂O (-63 kJ/mol per molecule)

**Example 2: Co-crystals and Solvates**
- Paracetamol monohydrate: (C₈H₉NO₂)·(H₂O) → 2 molecules per formula unit
- Pure paracetamol: C₈H₉NO₂ → 1 molecule per formula unit
- To compare stability, normalize per paracetamol molecule, not per formula unit

**Example 3: Polymorphs**
- Form I: 2 molecules in asymmetric unit → divide by 2 for per-molecule energy
- Form II: 4 molecules in asymmetric unit → divide by 4 for per-molecule energy
- Only then can you compare which polymorph is more stable

For ice example:
- Asymmetric unit energy: -125.6 kJ/mol (contains 2 H₂O)
- Per formula unit (H₂O): **-62.8 kJ/mol per molecule**
- Experimental sublimation: **+54.1 kJ/mol per molecule** (opposite sign)

**Why benchmarking studies use "per atom" units:**
Many computational method comparisons report errors in **meV/atom** rather than per unit cell or per molecule. This allows fair comparison across:
- Small molecules (few atoms) vs. large molecules (many atoms)
- Different crystal packing (1 vs. 8 molecules per unit cell)
- Various stoichiometries (AB vs. A₂B₃ compounds)

For example, a state-of-the-art method like [PET-MAD](https://arxiv.org/pdf/2503.14118) achieves ~20 meV/atom error:
- H₂O (3 atoms): 60 meV = 5.8 kJ/mol of water molecules
- Paracetamol (20 atoms): 400 meV = 38.6 kJ/mol of paracetamol molecules

For the most accurate bespoke dataset, errors can be as low as 3 meV/atom:
- H₂O (3 atoms): 9 meV = 0.9 kJ/mol of water molecules
- Paracetamol (20 atoms): 60 meV = 5.8 kJ/mol of paracetamol molecules
- Both represent the same **relative accuracy per atom**


## Connecting to Experiments: Sublimation Thermodynamics

For molecular crystals, the experimental sublimation enthalpy relates to our calculated lattice energy:

<div style={{textAlign: 'center'}}>

$$\Delta H_{sub} = -E_{lattice} + 2RT$$

</div>

The 2RT term (~5 kJ/mol at 298K) accounts for the difference between constrained vibrations in the crystal and free translation/rotation in the gas phase. For ice:

- Calculated $E_{lattice}$ = -62.8 kJ/mol
- Predicted $\Delta H_{sub}$ = 62.8 - 4.96 = 57.8 kJ/mol
- Experimental = 54.1 kJ/mol (7% error)

This excellent agreement validates the CE-1p approach for molecular crystals.


### Exercise 3: Lattice Energy and Crystal Cohesion

Finally, we tackle crystals using the CE-1P pairwise summation approach. This exercise demonstrates how pairwise models can work surprisingly well for molecular crystals, despite the many-body effects we've just studied. The key insight is that while individual three-body terms matter, their collective effect in crystals may well cancel and is often well-approximated by pairwise models.

<Tutorial
  title="Ice Lattice Energy Calculation"
  description="Calculate the lattice energy of ice Ih crystal using pairwise CE-1P interactions to understand crystal cohesion and predict sublimation enthalpy."
>
  <Step id="setup" title="Navigate to ice lattice energy directory">
    <Instructions>
      <p>Navigate to the ice_elat directory containing the crystal structure file and examine the setup.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`cd ../ice_elat/
ls -la
head -20 ice.cif"`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`ice.cif run_ice_elat.sh  example_ice_stdout

data_H2O
_symmetry_space_group_name_H-M   P6_3cm
_cell_length_a   7.60356630
_cell_length_b   7.60356630
_cell_length_c   7.14296200
_cell_angle_alpha   90.00000000
_cell_angle_beta   90.00000000
_cell_angle_gamma   120.00000000
_symmetry_Int_Tables_number   185
_chemical_formula_structural   H2O
_chemical_formula_sum   'H24 O12'
_cell_volume   357.63798996`}</code></pre>
    </Output>
    
    <Notes>
      <p>Ice Ih has hexagonal symmetry (space group P6_3cm) with a ≈ 7.6 Å and c ≈ 7.14 Å.</p>
    </Notes>
  </Step>

  <Step id="run_calculation" title="Run lattice energy calculation">
    <Instructions>
      <p>Execute the OCC elat (energy lattice) calculation using the CE-1P model.</p>
    </Instructions>
    
    <Commands>
      <pre><code>./run_ice_elat.sh --model ce-1p --threads 4</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`Neighbors for molecule 0
     Rn      Rc                Symop   E_coul     E_ex    E_rep    E_pol   E_disp    E_tot
===================================================================================
  1.667   2.672                    -  -61.688  -88.662  165.103   -8.693   -2.160  -30.744
  1.682   2.687                    -  -57.411  -83.945  156.064   -8.372   -2.151  -28.528
  1.682   2.687                    -  -57.411  -83.945  156.064   -8.372   -2.151  -28.528
  1.686   2.693                    -  -53.779  -82.590  153.337   -8.273   -2.157  -25.593
  2.785   4.374        -x,1-y,-1/2+z    2.514   -0.244    0.409   -0.231   -0.560    1.849

  Final energy: -125.590 kJ/mol
Lattice energy: -125.590 kJ/mol
...

=========================================
LATTICE ENERGY ANALYSIS
=========================================

Calculated lattice energies:
  Asymmetric unit:     -125.59 kJ/mol
  Per molecule:        -62.80 kJ/mol

Thermodynamic estimates:
  2RT at 298K:         4.96 kJ/mol
  ΔH_sub estimate:     57.84 kJ/mol

Experimental reference:
  ΔH_sub (exp):        ~54 kJ/mol
  Difference:          3.84 kJ/mol (7.1%)`}</code></pre>
    </Output>
    
    <Notes>
      <p>The asymmetric unit contains 2 water molecules, so we divide by 2 for per-molecule energy. The 7.1% error is excellent for a pairwise model, and undoubtedly comes from cancellation of errors on some level...</p>
    </Notes>
  </Step>
</Tutorial>

## Connecting Theory to Practice: What We've Learned

The three exercises above demonstrate key principles of many-body interactions and crystal energetics:

**From Exercise 1 (Water Trimers):**
- Many-body effects are real but modest (~5%) for hydrogen-bonded systems, trimers, quatermers etc. are still probably not representative of a bulk...
- Individual three-body terms can be calculated exactly for small systems

**From Exercise 2 (Cluster Convergence):**
- Simulation cutoffs represent accuracy vs. cost tradeoffs
- Different properties (energies vs. forces vs. phase behavior) may require different cutoffs

**From Exercise 3 (Crystal Lattice Energies):**
- Pairwise models can work remarkably well (~7% error) for molecular crystals
- This success occurs despite measurable many-body effects in small clusters

How can pairwise models work so well for crystals when we just showed many-body effects are important? The answer lies in **error cancellation**, and the nature of crystals vs. trimers:

1. **Many-body effects may cancel** - e.g. while the net polarisation of a molecule from 3 molecules might be very different than 2, it may be that for a full crystal these largely cancel... so:
2. **Collective effects average out** - individual cooperative/anti-cooperative terms partially cancel

This is why **understanding fundamentals matters** - it helps you recognize when approximations will work and when they'll fail. More importantly, testing and benchmarking accuracy is fundamental to understanding the success and potential failures of different models!

## The CE-1p Model for Crystals

The CE-1p model extends naturally from dimers to crystals by summing pairwise interactions. It captures the essential physics while remaining computationally efficient:

- **Input**: Crystal structure + monomer wavefunctions
- **Output**: Lattice energy with physical decomposition
- **Speed**: much much cheaper computationally than e.g. full periodic DFT
- **Accuracy**: MAD of 3.3 kJ/mol error for molecular crystals (X23 set)


## Practical Considerations and Challenges

### Convergence Issues with Ionic Crystals

The NaCl example demonstrates why simple cutoff-based summation fails for ionic systems. The long-range $r^{-1}$ electrostatics lead to:
- Wild energy oscillations with cutoff radius
- Dependence on summation order
- Need for Ewald summation or similar techniques

### Polymorphism: When Small Differences Matter

Many pharmaceutical compounds have multiple crystal forms (polymorphs) with energy differences < 5 kJ/mol. Since RT ≈ 2.5 kJ/mol at room temperature, thermal effects can reverse stability rankings. This is why:
- Temperature-dependent studies are crucial, and vibrational enthalpy contributions are important.
- Actual growth conditions (nucleation), kinetic factors often control which form crystallizes
- Computational predictions need ~1 kJ/mol accuracy

### Visualizing Crystal Energetics

Tools like CrystalExplorer can generate "energy frameworks" - 3D visualizations where tube thickness represents interaction strength. This reveals:
- Hydrogen bonding networks
- π-π stacking columns  
- Mechanical anisotropy origins

## Key Takeaways

✓ **Energy units matter** - always specify per molecule, per formula unit, or per atom

✓ **Pairwise models can work surprisingly well** - CE-1p achieves ~10% accuracy by smart parameterization

✓ **Convergence differs by system** - molecular crystals converge smoothly, ionic crystals oscillate wildly

✓ **Small energy differences** have big consequences - polymorphs often differ by < RT

✓ **Connect to experiment** through proper thermodynamics - don't forget the 2RT term!

Ready to see how crystals actually grow? Let's explore nucleation and growth mechanisms!
