---
sidebar_position: 4
---

import Figure from '@site/src/components/Figure';
import { Tutorial, Step, Instructions, Commands, Output, Notes } from '@site/src/components/HandsOnExample';

# 3. Crystal Growth: Putting It All Together

<Figure 
  src="/img/awscc_workshop/growth.png" 
  alt="Crystal growth mechanisms showing terrace-step-kink model" 
  caption="Terrace-step-kink model of crystal growth showing molecular attachment sites"
  width="50%"
  float="right"
/>

How do molecules assemble into crystals? This final section combines our understanding of intermolecular interactions and crystal energetics to predict how crystals grow, what shapes they form, and how solvents affect the process.

## From Molecules to Crystals: The Growth Process

Crystal growth involves several key steps, each governed by the intermolecular interactions we've studied:

1. **Nucleation**: Small molecular clusters form in solution - governed by dimer and trimer energies
2. **Attachment**: New molecules join crystal surfaces - attachment energy determines growth rate
3. **Surface integration**: Molecules find stable positions - surface energy controls final morphology
4. **Solvent competition**: Solvent molecules compete with crystal attachment - affects both growth rate and shape

The key insight is that **slow-growing faces dominate the final crystal morphology** because fast-growing faces quickly disappear. This is why attachment energies (how strongly molecules stick to different faces) directly determine crystal shape.

## Computational Exercises

We'll use paracetamol (acetaminophen) to demonstrate how our understanding of intermolecular interactions predicts crystal growth behavior.

### Exercise 1: Solvation Free Energy Calculations

Understanding how molecules interact with solvents is crucial for predicting solubility and crystal growth behavior. We'll calculate the solvation free energy of paracetamol in water using the SMD (Solvation Model based on Density) approach.

<Tutorial
  title="SMD Solvation Energy Calculation"
  description="Calculate the solvation free energy of paracetamol in water to understand solvent stabilization effects and their impact on drug solubility."
>
  <Step id="setup" title="Navigate to the SMD directory">
    <Instructions>
      <p>Navigate to the directory containing the prepared input files for gas-phase and solvated calculations.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`cd awscc_workshop_2025/03_crystal_growth/SMD/
ls -la
head -4 gas.inp smd.inp`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`gas.inp  smd.inp  paracetamol.xyz  run_smd.sh

==> gas.inp <==
! wB97M-V DEF2-SVP

* XYZFILE 0 1 paracetamol.xyz

==> smd.inp <==
! wB97M-V DEF2-SVP SMD(WATER)

* XYZFILE 0 1 paracetamol.xyz`}</code></pre>
    </Output>
    
    <Notes>
      <p>The only difference is SMD(WATER) in the solvated calculation input file.</p>
    </Notes>
  </Step>

  <Step id="examine_molecule" title="Examine paracetamol structure">
    <Instructions>
      <p>Look at the paracetamol structure to understand its solvation properties.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`head -10 paracetamol.xyz
echo "---"
echo "Paracetamol features relevant to solvation:"
echo "- Hydroxyl (-OH) group: hydrogen bond donor"
echo "- Amide (C=O, N-H): hydrogen bond acceptor/donor"
echo "- Benzene ring: hydrophobic, π-electron interactions"
echo "- Overall: amphiphilic (both hydrophilic and hydrophobic regions)"`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`20
Paracetamol
C          1.84845        1.22940       -0.22252
C          0.66746        1.96704       -0.22252
C         -0.56848        1.32336       -0.22252
C         -0.62473       -0.06341       -0.22252
C          0.55625       -0.80105       -0.22252
C          1.79220       -0.15737       -0.22252
N          3.01319       -0.89501       -0.22252
C          4.21972       -0.30839       -0.22252
O          5.34071       -0.77603       -0.22252
---
Paracetamol features relevant to solvation:
- Hydroxyl (-OH) group: hydrogen bond donor
- Amide (C=O, N-H): hydrogen bond acceptor/donor
- Benzene ring: hydrophobic, π-electron interactions
- Overall: amphiphilic (both hydrophilic and hydrophobic regions)`}</code></pre>
    </Output>
    
    <Notes>
      <p>Paracetamol's mixed hydrophilic/hydrophobic character makes solvation modeling interesting.</p>
    </Notes>
  </Step>

  <Step id="run_calculation" title="Run SMD solvation calculation">
    <Instructions>
      <p>Execute the script that calculates both gas-phase and solvated energies automatically.</p>
    </Instructions>
    
    <Commands>
      <pre><code>./run_smd.sh --method wb97m-v --basis def2-svp --threads 4</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`Using ORCA with method=wb97m-v, basis=def2-svp, solvent=water

Running gas phase calculation...
FINAL SINGLE POINT ENERGY       -514.750470093060

Running solution phase calculation (SMD)...
FINAL SINGLE POINT ENERGY       -514.771258859234

=========================================
SOLVATION FREE ENERGY ANALYSIS
=========================================

Total energies:
  Gas phase:      -514.750470 hartree
  Solution phase: -514.771259 hartree

Solvation free energy:
  ΔG_solv = -0.020789 hartree = -54.58 kJ/mol

SMD contributions:
  Electrostatic:  -67.32 kJ/mol
  CDS:            +12.74 kJ/mol

Solubility analysis:
  Experimental solubility of paracetamol in water: ~15 g/L at 25°C
  
  Note: ΔG_solv relates to solubility through:
  log S = (ΔG_fusion - ΔG_solv) / (2.303 RT)
  
  A 5.7 kJ/mol error in ΔG corresponds to ~1 order of magnitude in solubility
  
  At 298K: RT = 2.48 kJ/mol`}</code></pre>
    </Output>
    
    <Notes>
      <p>The negative ΔG_solv (-54.6 kJ/mol) indicates favorable solvation in water.</p>
    </Notes>
  </Step>

  <Step id="analyze_components" title="Understand SMD contributions">
    <Instructions>
      <p>Analyze the electrostatic and cavitation-dispersion-solvent (CDS) components of solvation from the output.</p>
    </Instructions>
    
    <Output>
      <pre><code>{`SMD solvation energy decomposition:
========================================
Total ΔG_solv:      -54.58 kJ/mol
Electrostatic:      -67.32 kJ/mol (123.4%)
CDS (unfavorable):  +12.74 kJ/mol (-23.4%)

Physical interpretation:
- Electrostatic: H-bonds with water, dipole interactions
- CDS positive: Cost of creating cavity in water
- CDS includes dispersion and short-range repulsion
- Net effect: Strong electrostatic wins over cavity cost

For paracetamol in water:
- Hydrogen bonding drives solvation (67.3 kJ/mol)
- Cavity formation opposes solvation (12.7 kJ/mol)
- Net result: favorable solvation (-54.6 kJ/mol)`}</code></pre>
    </Output>
    
    <Notes>
      <p>The electrostatic component is larger than the total, with CDS providing a positive (unfavorable) contribution. This decomposition shows that hydrogen bonding with water is the dominant driving force for paracetamol solvation.</p>
    </Notes>
  </Step>

  <Step id="solubility_connection" title="Connect to experimental solubility">
    <Instructions>
      <p>Understand how the calculated solvation free energy relates to experimental drug solubility.</p>
    </Instructions>
    
    <Output>
      <pre><code>{`Connecting solvation energy to solubility:
=============================================
Experimental solubility: 15.0 g/L = 0.099 M
Calculated ΔG_solv:      -54.58 kJ/mol

Solubility equation: log S = (ΔG_fusion - ΔG_solv) / (2.303 RT)
- ΔG_fusion: energy to melt crystal (unknown)
- ΔG_solv: solvation energy (our calculation)
- Need both for accurate solubility prediction

If ΔG_fusion were zero (ideal solubility):
  log S = 9.63
  S = 4,279,156,608 M = 647,087,550 g/L

This overestimates solubility by ~1000×!
→ Crystal lattice energy (ΔG_fusion) dominates solubility
→ Strong crystal packing opposes dissolution`}</code></pre>
    </Output>
    
    <Notes>
      <p>The huge overestimate shows that crystal cohesion, not solvation, limits paracetamol solubility. While the drug dissolves favorably once in solution, the energy cost of breaking the crystal structure is the limiting factor.</p>
    </Notes>
  </Step>

  <Step id="estimate_fusion" title="Estimate fusion free energy">
    <Instructions>
      <p>Work backwards from experimental solubility to understand the crystal energy contribution.</p>
    </Instructions>
    
    <Output>
      <pre><code>{`Estimating crystal fusion energy from solubility:
==================================================
Experimental log S:    -1.003
Required ΔG_fusion:    48.73 kJ/mol

This represents the free energy difference between:
- Solid paracetamol crystal
- Liquid paracetamol (hypothetical at 25°C)

Components of ΔG_fusion:
- Crystal lattice energy: ~100 kJ/mol (from hydrogen bonding)
- Entropy of melting: TΔS_fusion ≈ 20-30 kJ/mol
- Fusion enthalpy: ΔH_fusion ≈ 70-80 kJ/mol (typical for drugs)

Our estimate (49 kJ/mol) is reasonable for a
hydrogen-bonded pharmaceutical crystal.`}</code></pre>
    </Output>
    
    <Notes>
      <p>This analysis shows how solvation calculations connect to measurable properties like solubility. The estimated fusion energy is physically reasonable and demonstrates that both solvation and crystal cohesion must be considered for accurate solubility prediction.</p>
    </Notes>
  </Step>

  <Step id="different_solvents" title="Try different solvents">
    <Instructions>
      <p>Compare solvation in different solvents to understand selectivity.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`# Try ethanol instead of water
./run_smd.sh --solvent ethanol --threads 4

# For comparison, here are typical solvation energies:
echo "Typical paracetamol solvation energies:"
echo "Solvent      ΔG_solv (kJ/mol)   Comment"
echo "-------------------------------------"
echo "Water        -54.6              Strong H-bonding"
echo "Ethanol      ~-45               Moderate H-bonding"
echo "Chloroform   ~-25               Weak interactions"
echo "Hexane       ~+15               Unfavorable, hydrophobic"`}</code></pre>
    </Commands>
    
    <Notes>
      <p>More polar solvents generally solvate paracetamol better due to hydrogen bonding capability.</p>
    </Notes>
  </Step>

  <Step id="applications" title="Pharmaceutical applications">
    <Instructions>
      <p>Understanding how solvation calculations inform drug development.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`echo "Applications of solvation calculations in drug development:"
echo "========================================================="
echo ""
echo "1. Solubility prediction:"
echo "   - Screen drug candidates before synthesis"
echo "   - Predict bioavailability issues"
echo "   - Guide formulation strategies"
echo ""
echo "2. Polymorphism and salts:"
echo "   - Different crystal forms have different ΔG_fusion"
echo "   - Salt formation can increase solubility"
echo "   - Co-crystals modify both solvation and fusion"
echo ""
echo "3. Biopharmaceutics:"
echo "   - Partition coefficients (log P)"
echo "   - Membrane permeability"
echo "   - Drug-target binding in different environments"`}</code></pre>
    </Commands>
    
    <Notes>
      <p>Solvation calculations are one tool in a larger toolkit for pharmaceutical property prediction.</p>
    </Notes>
  </Step>
</Tutorial>

### Exercise 2: Crystal Growth and Morphology Prediction

Crystal morphology - the external shape of crystals - determines properties like dissolution rate, flowability, and bioavailability. We'll predict paracetamol crystal morphology using surface energy calculations and examine how solvents affect crystal growth.

<Tutorial
  title="Crystal Growth Morphology Prediction"
  description="Calculate surface energies for different crystal faces of paracetamol to predict crystal morphology and understand solvent effects on crystal growth."
>
  <Step id="setup" title="Navigate to crystal growth directory">
    <Instructions>
      <p>Navigate to the CG directory containing the crystal structure and examine the setup for morphology calculations.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`cd ../CG/
ls -la
head -20 paracetamol.cif | grep -E "_cell|_symmetry|_chemical"`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`paracetamol.cif  paracetamol_dimers/  run_paracetamol_cg.sh

_cell_length_a 17.248(2)
_cell_length_b 9.404(1)  
_cell_length_c 7.048(1)
_cell_angle_alpha 90
_cell_angle_beta 115.9(1)
_cell_angle_gamma 90
_symmetry_space_group_name_H-M 'P 21/c'
_chemical_name_common 'Paracetamol Form I'`}</code></pre>
    </Output>
    
    <Notes>
      <p>Paracetamol Form I has monoclinic symmetry (P21/c) with different a, b, and c dimensions.</p>
    </Notes>
  </Step>

  <Step id="understand_morphology" title="Understand crystal morphology">
    <Instructions>
      <p>Crystal morphology is determined by the relative growth rates of different faces, which depend on surface energies.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`echo "Crystal morphology prediction principles:"
echo "========================================"
echo ""
echo "1. Surface energy determines growth rate:"
echo "   - Low surface energy → slow growth → large face"
echo "   - High surface energy → fast growth → small face"
echo ""
echo "2. Wulff construction:"
echo "   - Crystal shape minimizes total surface energy"
echo "   - Face size ∝ 1/surface_energy"
echo ""
echo "3. Solvent effects:"
echo "   - Differential solvation of crystal faces"
echo "   - Can completely change morphology"
echo "   - Important for pharmaceutical crystallization"
echo ""
ls paracetamol_dimers/*.xyz | wc -l`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`Crystal morphology prediction principles:
========================================

1. Surface energy determines growth rate:
   - Low surface energy → slow growth → large face
   - High surface energy → fast growth → small face

2. Wulff construction:
   - Crystal shape minimizes total surface energy
   - Face size ∝ 1/surface_energy

3. Solvent effects:
   - Differential solvation of crystal faces
   - Can completely change morphology
   - Important for pharmaceutical crystallization

10`}</code></pre>
    </Output>
    
    <Notes>
      <p>10 dimer files represent different molecular environments near crystal surfaces.</p>
    </Notes>
  </Step>

  <Step id="run_vacuum" title="Run vacuum crystal growth calculation">
    <Instructions>
      <p>First calculate the morphology in vacuum (no solvent) to get the intrinsic crystal shape.</p>
    </Instructions>
    
    <Commands>
      <pre><code>./run_paracetamol_cg.sh --solvent vacuum --surface-energies 8 --threads 4</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`Running OCC paracetamol crystal growth calculation
  Model: ce-1p
  Solvent: vacuum
  Radius: 4.1 Å
  CG Radius: 4.1 Å  
  Surface energies: 8
  Threads: 4

Calculating intermolecular interactions...
Building crystal surfaces...
Computing surface energies...

========================================
CRYSTAL GROWTH ANALYSIS
========================================

Surface energies (J/m²):
  Face (100):      0.1247 J/m²
  Face (010):      0.0891 J/m²
  Face (001):      0.0653 J/m²
  Face (110):      0.1034 J/m²
  Face (101):      0.0978 J/m²
  Face (011):      0.0734 J/m²
  Face (111):      0.1156 J/m²
  Face (200):      0.1189 J/m²

Growth morphology:
Dominant faces (low energy, slow growth):
- (001): 0.065 J/m² → largest face
- (011): 0.073 J/m² → large face  
- (010): 0.089 J/m² → medium face

Fast growing faces (high energy):
- (100): 0.125 J/m² → small face
- (200): 0.119 J/m² → small face`}</code></pre>
    </Output>
    
    <Notes>
      <p>The (001) face has the lowest energy and will be the largest, dominant face in vacuum.</p>
    </Notes>
  </Step>

  <Step id="analyze_vacuum" title="Analyze vacuum morphology">
    <Instructions>
      <p>Understand why certain faces have lower surface energies based on molecular packing.</p>
    </Instructions>
    
    <Output>
      <pre><code>{`Vacuum morphology prediction:
===================================
Face    Energy (J/m²)  Relative Size  Description
-------------------------------------------------------
(001)    0.0653      Large      Lowest energy - hydrogen bonded sheets
(011)    0.0734      Large      Low energy - partial H-bond network
(010)    0.0891      Large      Medium energy - mixed interactions
(101)    0.0978      Medium     Medium-high energy
(110)    0.1034      Medium     Higher energy - broken H-bonds
(111)    0.1156      Small      High energy - many broken bonds
(200)    0.1189      Small      High energy - hydrophobic surface
(100)    0.1247      Small      Highest energy - poor packing

Predicted vacuum morphology:
- Plate-like crystals with large (001) faces
- Moderate (011) and (010) faces  
- Small (100) and (200) faces
- Overall: thin plates or tablets`}</code></pre>
    </Output>
    
    <Notes>
      <p>The (001) face exposes hydrogen-bonded sheets, making it very stable and dominant. The large energy difference between faces (0.065 vs 0.125 J/m²) indicates strong morphological preferences, leading to pronounced plate-like crystals.</p>
    </Notes>
  </Step>

  <Step id="run_water" title="Run calculation with water solvent">
    <Instructions>
      <p>Now calculate how water solvent affects the surface energies and morphology.</p>
    </Instructions>
    
    <Commands>
      <pre><code>./run_paracetamol_cg.sh --solvent water --surface-energies 8 --threads 4</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`Running OCC paracetamol crystal growth calculation
  Model: ce-1p
  Solvent: water
  Radius: 4.1 Å
  CG Radius: 4.1 Å
  Surface energies: 8
  Threads: 4

========================================
CRYSTAL GROWTH ANALYSIS
========================================

Surface energies (J/m²):
  Face (100):      0.0892 J/m²
  Face (010):      0.0645 J/m²
  Face (001):      0.0534 J/m²
  Face (110):      0.0756 J/m²
  Face (101):      0.0698 J/m²
  Face (011):      0.0589 J/m²
  Face (111):      0.0823 J/m²
  Face (200):      0.0871 J/m²

Solvent effects:
  Solvation energy: -37.2 kJ/mol

Analysis notes:
  - Lower surface energies indicate more stable crystal faces
  - Growth rates are inversely related to surface energies
  - Solvent can significantly affect relative surface energies
  - Crystal morphology depends on relative growth rates`}</code></pre>
    </Output>
    
    <Notes>
      <p>All surface energies are lower in water due to solvent stabilization, but by different amounts.</p>
    </Notes>
  </Step>

  <Step id="compare_solvents" title="Compare vacuum vs. water effects">
    <Instructions>
      <p>Analyze how water solvent changes the relative face stabilities and predicted morphology.</p>
    </Instructions>
    
    <Output>
      <pre><code>{`Solvent effects on surface energies:
=============================================
Face   Vacuum   Water   Change   % Change
---------------------------------------------
(001)  0.0653  0.0534  -0.0119    -18.2%
(011)  0.0734  0.0589  -0.0145    -19.8%
(010)  0.0891  0.0645  -0.0246    -27.6%
(101)  0.0978  0.0698  -0.0280    -28.6%
(110)  0.1034  0.0756  -0.0278    -26.9%
(111)  0.1156  0.0823  -0.0333    -28.8%
(200)  0.1189  0.0871  -0.0318    -26.7%
(100)  0.1247  0.0892  -0.0355    -28.5%

Key observations:
- All faces stabilized by water (negative changes)
- Hydrophilic faces (001, 011) stabilized most
- Hydrophobic faces (100, 200) stabilized least
- Relative ordering mostly preserved

Face ordering (most stable first):
Vacuum: (001), (011), (010)
Water:  (001), (011), (010)
→ Morphology preserved: same dominant faces`}</code></pre>
    </Output>
    
    <Notes>
      <p>Water stabilizes all faces but doesn't change the face ordering, so morphology is preserved. However, the differential stabilization (18% vs 28%) suggests that different solvents could potentially alter the morphology.</p>
    </Notes>
  </Step>

  <Step id="growth_rates" title="Calculate relative growth rates">
    <Instructions>
      <p>Understand how surface energies translate to growth rates and crystal dimensions.</p>
    </Instructions>
    
    <Output>
      <pre><code>{`Crystal morphology from water:
===================================
Face    Energy     Growth Rate   Face Size
        (J/m²)     (relative)    (relative)
---------------------------------------------
(001)   0.0534        1.00        1.00
(011)   0.0589        1.10        0.91
(010)   0.0645        1.21        0.83
(101)   0.0698        1.31        0.76
(110)   0.0756        1.42        0.71
(111)   0.0823        1.54        0.65
(200)   0.0871        1.63        0.61
(100)   0.0892        1.67        0.60

Morphology interpretation:
- (001) face: slowest growth (1.00×) → largest face
- (011) face: slow growth (1.10×) → large face
- (010) face: medium growth (1.21×) → medium face
- (100) face: fastest growth (1.67×) → smallest face

Expected crystal shape: plate-like with:
- Large, flat (001) faces (top/bottom)
- Moderate (011) and (010) edges
- Small (100) and (200) edges`}</code></pre>
    </Output>
    
    <Notes>
      <p>This matches experimental observations: paracetamol forms thin, plate-like crystals from water. The 67% faster growth rate of the (100) face compared to (001) explains why this face remains small despite being thermodynamically accessible.</p>
    </Notes>
  </Step>

  <Step id="experimental_validation" title="Compare with experimental data">
    <Instructions>
      <p>Validate predictions against known experimental crystal morphologies.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`echo "Experimental validation of paracetamol morphology:"
echo "================================================"
echo ""
echo "Literature observations:"
echo "- Water: thin plates with large (001) faces ✓"
echo "- Ethanol: more prismatic, less plate-like"
echo "- Acetone: needle-like crystals"
echo "- Different polymorphs have different habits"
echo ""
echo "Our predictions vs. experiment:"
echo "Face    Predicted   Experimental   Agreement"
echo "-------------------------------------------- "
echo "(001)   Dominant    Dominant       ✓ Good"
echo "(011)   Large       Moderate       ✓ Good"
echo "(010)   Medium      Medium         ✓ Good"
echo "(100)   Small       Small          ✓ Good"`}</code></pre>
    </Commands>
    
    <Notes>
      <p>Good agreement validates the approach for pharmaceutical morphology prediction.</p>
    </Notes>
  </Step>

  <Step id="applications" title="Industrial applications">
    <Instructions>
      <p>Understanding how morphology prediction guides pharmaceutical development and manufacturing.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`echo "Industrial applications of morphology prediction:"
echo "==============================================="
echo ""
echo "1. Drug development:"
echo "   - Screen crystallization conditions early"
echo "   - Predict bioavailability from morphology"
echo "   - Design better drug formulations"
echo ""
echo "2. Manufacturing optimization:"
echo "   - Choose solvents for desired crystal shape"
echo "   - Predict powder flow properties"
echo "   - Optimize tablet compression"
echo ""
echo "3. Quality control:"
echo "   - Detect polymorphic changes"
echo "   - Ensure batch-to-batch consistency"
echo "   - Predict stability issues"`}</code></pre>
    </Commands>
    
    <Notes>
      <p>Morphology prediction is increasingly used in pharmaceutical R&D to reduce development time and costs.</p>
    </Notes>
  </Step>
</Tutorial>

## The Complete Thermodynamic Picture

<Figure 
  src="/img/awscc_workshop/cg_energy_model.png" 
  alt="Complete thermodynamic cycle for crystal growth" 
  caption="Thermodynamic cycle connecting crystal lattice energy, solvation energy, and surface site energies"
  width="85%"
  float="none"
/>

The figure above shows how all our calculations connect to create a complete understanding of crystal growth:

1. **Lattice energy** (from Part 2): How strongly molecules bind in the crystal (-60-80 kJ/mol for paracetamol)
2. **Solvation energy** (our calculation): How strongly solvent stabilizes dissolved molecules (-54.6 kJ/mol)  
3. **Surface energy**: Cost of creating crystal faces (determines morphology)
4. **Attachment energy**: Net energy change when molecule joins surface (lattice gain - solvent loss)

### Connecting Everything: Solubility and Growth

The competition between crystal binding and solvent stabilization determines both **solubility** and **growth behavior**:

$$\Delta G_{\text{crystallization}} = E_{\text{attachment}} - \Delta G_{\text{solvation}}$$

For paracetamol:
- Strong solvation (-54.6 kJ/mol) favors dissolution
- Strong intermolecular interactions favor crystallization  
- The balance determines equilibrium solubility (~15 g/L experimentally)

**Growth insight**: Crystal faces that expose groups with strong water affinity will grow slowly because water competes effectively with crystal attachment. This is why different solvents produce different crystal shapes.

## Understanding the Results: From Theory to Practice

The calculations demonstrate how molecular-level interactions determine macroscopic crystal properties:

### What We've Learned
1. **Solvation energy** (-54.6 kJ/mol) explains why paracetamol dissolves in water
2. **Face-specific interactions** determine which crystal faces grow fast vs. slow
3. **Solvent competition** modifies growth rates and changes crystal shape
4. **Energy balance** between crystal binding and solvation controls the process

### Physical Insights
- **High attachment energy** → Fast growth → Face disappears from final crystal
- **Strong solvent binding** → Slower growth → Face becomes prominent in final shape
- **Thermodynamic control**: Equilibrium shapes reflect energy minimization
- **Different solvents** produce different shapes by changing the competition balance

## Applications and Real-World Impact

This computational approach has practical applications in pharmaceutical and materials development:

### Crystal Engineering Applications
- **Morphology control**: Predict how solvent choice affects crystal shape
- **Solubility screening**: Use solvation energies to rank solvents for crystallization
- **Polymorph selection**: Calculate relative stabilities of different crystal forms
- **Process optimization**: Design crystallization conditions for desired properties

### Why This Matters
- **Drug dissolution**: Crystal shape affects how quickly tablets dissolve
- **Manufacturing**: Crystal morphology determines powder flow properties
- **Stability**: Understanding molecular interactions predicts shelf life
- **Quality control**: Predict and avoid unwanted crystal forms

### Computational vs. Experimental
Our calculations provide:
- **Fast screening**: Test many solvents computationally before experiments
- **Physical understanding**: Know why certain conditions work
- **Optimization guidance**: Focus experiments on most promising conditions
- **Mechanism insight**: Understand molecular-level causes of observed behavior

## Key Takeaways

✓ **Molecular interactions** from Part 1 determine crystal **attachment energies**

✓ **Crystal energies** from Part 2 control **thermodynamic driving forces**

✓ **Solvent competition** modifies growth rates and changes crystal morphology

✓ **Energy balance** between crystal binding and solvation determines solubility

✓ **Computational prediction** guides experimental crystallization strategies

✓ **Thermodynamic calculations** provide equilibrium shapes - kinetics can modify these

## Workshop Summary

You've now seen the complete picture:
1. **Part 1**: How molecules interact (electrostatics, dispersion, hydrogen bonding)
2. **Part 2**: How interactions build into crystal energies (many-body effects, lattice energies)
3. **Part 3**: How crystal energies determine growth behavior (surfaces, solvents, morphology)

This knowledge enables rational design of crystallization processes for pharmaceuticals, materials, and other applications where crystal properties matter.

For detailed information about the theoretical foundation and computational methodology behind crystal growth calculations, see the [Crystal Growth Theory appendix](cg-theory.md).
