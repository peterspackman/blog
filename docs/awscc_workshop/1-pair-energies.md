---
sidebar_position: 2
---

import WaterDimerEnergy from '@site/src/components/WaterDimerEnergy';
import Figure from '@site/src/components/Figure';
import { Tutorial, Step, Instructions, Commands, Output, Notes } from '@site/src/components/HandsOnExample';

# 1. Intermolecular Interactions: From Theory to Practice

Much of chemistry and materials science involves condensed matter, that is to intermolecular interactions (or perhaps more accurately non-bonded interactions). Understanding these interactions is therefore fundamental to many applications of computational chemistry. Since theoretical and computational chemistry is generally focused on getting the best answer in a tractable amount of computer time, it's essntial to know which kinds of interactions are important for which systems, and cheap and dirty can we be in their approximation when explaining or predicting some overvable phenomenon.

## Gibbs Free Energy vs. Enthalpy

To cut a very long story short, we can start with the Gibbs free energy to determine whether molecular association is spontaneous under given conditions ($T$, $P$). Recall that the Gibbs free energy combines energetic and entropic contributions:

$$ \Delta G = \Delta H - T \Delta S$$

i.e.

$$\Delta G_{\text{dimer}} = \Delta H_{\text{dimer}} - T\Delta S_{\text{dimer}}$$

In practice, we're often primarily concerned with predicting the enthalpy contribution because:

1. **Entropy is quite often similar across related systems** - For comparing similar binding modes, $\Delta S$ varies less than $\Delta H$ (and $\Delta S$ can be much harder to model...)
2. **Low temperatures reduce entropic contributions** - At cryogenic crystal structure conditions, $T\Delta S$ becomes small
3. **Enthalpy dominates strong interactions** - For hydrogen bonds and ionic interactions, $|\Delta H| >> |T\Delta S|$
4. **Computational efficiency** - Energy calculations on a static system directly yield energies related to enthalpy (at least much of the energy)

### Hess's law: Enthalpy is path-independent

For a given molecular dimer or pair for example, this means that *regardless of how they came to be in a given configuration* we can calculate the enthalpy as:

$$\Delta H_{\text{binding}} = H_{\text{dimer}} - H_{\text{monomer A}} - H_{\text{monomer B}}$$

This can be done via electronic structure calculations, molecular mechanics force fields, tight-binding, machine learned potentials or really any method that computes the total energy for a given system:

$$\Delta E_{\text{binding}} = E_{AB} - E_A - E_B$$

This binding energy is not the whole picture, there are other enthalpy contributions:

$$\Delta H = \Delta E + \Delta(PV) + \Delta E_{\text{ZPE}} + \Delta E_{\text{thermal}}$$

For condensed phases and moderate temperatures:
- $\Delta(PV) \approx 0$ (negligible volume change)
- $\Delta E_{\text{thermal}} \approx 0$ (a common assumption)

Therefore:
$$\Delta H \approx \Delta E + \Delta E_{\text{ZPE}}$$

And often the zero-point energy correction is also small, giving:
$$\Delta H \approx \Delta E$$

This is why computational chemists often report energy calculations as approximations to enthalpies, but keep this in mind when considering systems you're working with...


## (Some of) the Physics of Intermolecular Forces

Different types of interactions arise from different quantum mechanical phenomena, and most of them are approximated in molecular mechanics and force fields via analysis of the long-range or asymptotic behaviour.

:::warning[Consider whether the approximations are sensible]

Even in the text below I'll talk about where some effects are or are not important, but you should always consider whether that is correct and why approximations might be sensible (or *not*) for a given system. Nothing beats understanding the fundamental physics (QM) or actual experiments.

:::

### 1. Electrostatic (Coulomb) Interactions

<Figure 
  src="/img/awscc_workshop/coulomb.png" 
  alt="Electrostatic interaction between charges" 
  caption="Coulomb interaction between partial charges"
  width="300px"
  float="right"
/>

The classical electrostatic energy between charges $q_i$ and $q_j$ separated by distance $r_{ij}$:

$$ E_\text{elec} = \sum_{i<j} \frac{q_i q_j}{r_{ij}}$$

That is if we just work in atomic units so we can do away with the constant factor of $\frac{1}{4\pi\epsilon_0}$

This is fundamentally important for condensed matter, as it's the longest-range interaction (i.e. slowest to decay to 0), decaying as $1/r$.

If we instead had a multipole series:

$$E_{\text{elec}} = E_{\text{charge-charge}} + E_{\text{charge-dipole}} + E_{\text{dipole-dipole}} + ...$$

This stems from the Taylor expansion of the Coulomb interaction. Most force-fields don't even bother considering dipoles, but few if any include terms beyond quadrupoles.

These point charges can be placed wherever you see fit, though the mathematics for e.g. forces becomes much simpler if they are at atomic sites i.e. partial charges. Indeed we can approximate e.g. atomic dipoles, quadrupoles etc. through partial charges around the atoms (in the limit, we have a full electron density distribution).

### 2. Exchange-Repulsion (Pauli Exclusion)

<Figure 
  src="/img/awscc_workshop/exchange.png" 
  alt="Exchange-repulsion between electron clouds" 
  caption="Pauli repulsion prevents orbital overlap"
  width="50%"
  float="right"
/>

When electron clouds overlap, the Pauli exclusion principle requires antisymmetrization of the wavefunction, leading to repulsion:

$$E_{\text{exch}} \propto \text{exp}(-\alpha r)$$

This short-range repulsion prevents molecular interpenetration. This is the source of the $\text{exp}(-\alpha r)$ term in Buckingham potentials and many others. The Lennard Jones potential is effectively approximating this as $1/r^{12}$

### 3. Polarization (Induction)

<Figure 
  src="/img/awscc_workshop/polarization.png" 
  alt="Induced dipole from electric field" 
  caption="Electric field inducing molecular polarization"
  width="300px"
  float="right"
/>

The electric field of molecule A induces a dipole in molecule B:

$$E_{\text{ind}} = -\frac{1}{2}\alpha_B |E_A|^2$$

where $\alpha_B$ is the polarizability of molecule B. This scales as $r^{-4}$ for charge-induced dipole interactions. This magical formula might seem great but it's important to consider polarzability as *effectively* a volume term, and that this is fundamentally approximating the polarizable volume of some site as spherical/isotropic.

### 4. Dispersion (London Forces, van der Waals)

<Figure 
  src="/img/awscc_workshop/dispersion.png" 
  alt="Dispersion interaction from electron density fluctuations" 
  caption="London dispersion from correlated electron fluctuations"
  width="50%"
  float="right"
/>

Perhaps the most important kind of intermolecular interaction to consider due to its pervasiveness is London Dispersion!

All molecules interact via quantum mechanical fluctuations in electron density:

$$E_{\text{disp}} = -\frac{3}{2}\frac{I_A I_B}{I_A + I_B}\frac{\alpha_A \alpha_B}{r^6}$$

where $I$ represents ionization potentials. This $r^{-6}$ attraction is universal.

People frequently refer to this as a **weak** interaction, but its ubiquity means that for many molecular crystals for example it's the most important energetic term...

## A classical example: the argon dimer

<Figure 
  src="/img/awscc_workshop/lennard_jones_potential.png" 
  alt="Lennard-Jones potential energy curve" 
  caption="The Lennard-Jones potential showing repulsive and attractive regions"
  width="60%"
  float="right"
/>

For noble gases like argon, only dispersion and exchange-repulsion really matter. The Lennard-Jones potential captures this physics:

$$V_{LJ}(r) = 4\epsilon\left[\left(\frac{\sigma}{r}\right)^{12} - \left(\frac{\sigma}{r}\right)^6\right]$$

Where:
- $\epsilon$ = well depth (attraction strength)
- $\sigma$ = distance where $V_{LJ} = 0$
- $r^{-12}$ term models exchange-repulsion
- $r^{-6}$ term models dispersion

For Ar-Ar:
- $\epsilon = 0.996$ kJ/mol
- $\sigma = 3.401$ Å
- $r_{\text{min}} = 3.816$ Å

The $r^{-12}$ repulsion is empirical; more accurate potentials use exponential forms.

This works well for a number of reasons, but it's also quick to calculate! Don't need to take a square root when computing distances, $r^{12} = (r^6)^2$ etc.

### Combining Rules for Mixed Interactions

These parameters and their physical interpretation also lead to so-called combining rules. When atoms of different types interact, combining rules can be used determine their interaction parameters - this makes fitting a force field require less parameters, be less likely to overfit and much else.

**Lorentz-Berthelot rules (most common):**
- $\sigma_{ij} = \frac{\sigma_{ii} + \sigma_{jj}}{2}$ (arithmetic mean of sizes)
- $\epsilon_{ij} = \sqrt{\epsilon_{ii} \epsilon_{jj}}$ (geometric mean of well depths)

**Physical justification:**
- Size parameter ($\sigma$): Contact distance is roughly additive
- Energy parameter ($\epsilon$): Well depth relates to $\sqrt{I_i I_j}$ from dispersion theory

**Example for O-H interaction:**
- If $\epsilon_O = 0.65$ kJ/mol and $\epsilon_H = 0.016$ kJ/mol
- Then $\epsilon_{OH} = \sqrt{0.65 \times 0.016} = 0.10$ kJ/mol
- If $\sigma_O = 3.17$ Å and $\sigma_H = 2.65$ Å  
- Then $\sigma_{OH} = (3.17 + 2.65)/2 = 2.91$ Å

There are of course many other combining rules...

## Hands on case study: the water dimer

With all that in mind, let's examine a water dimer.
Water dimers showcase all four interaction types. The hydrogen bond involves:

1. **Electrostatic attraction** between O(-) and H(+)
2. **Exchange-repulsion** at short distances  
3. **Polarization** as the H-bond enhances dipoles - we're going to ignore this in our force field
4. **Dispersion** between electron clouds

### An interactive force field for the water dimer.

The interactive visualisation below demonstrates combining rules in action. You can adjust Lennard-Jones parameters and partial charges, and and see how they affect the energy of the dimer at different separations.

Use this interactive tool to consider the following questions:

1. *How correlated are the parameters? I.e. if we change the charge can we adjust something else to compensate*
2. *Can we get the right energy at equilibrium without the right behaviour in general?*
3. *Is it enough to focus on a 1-dimensional slice of the potential energy surface for a water dimer if we were to use this force field for e.g. liquid water?*

<WaterDimerEnergy />

## Computational Exercises

At it's core, the most simple way to compute a pair energy is via the previously mentioned energy difference:

$$ E_\text{interaction} = E_\text{AB} - E_\text{A} - E_\text{B}$$

i.e. we'd need 3 calculations, one for each monomer and one for the pair!

**However**, in the case of isolated molecules we also need to relax (geometry optimise) each component individually in order to have a fair comparison and an accurate interaction energy.

:::warning[About geometry optimisation]
Throughout these exercises we're going to ignore the relaxation aspect of interactions. It **is** important, but it makes the calculations take longer and it's just more things to worry about for now. So just pretend it's all there, but keep in mind for the future especially for flexible molecules this can be a major component of the energy.
:::

### Exercise 1: Basic Interaction Energy Calculation

Understanding how molecules interact is fundamental to computational chemistry. We'll calculate the interaction energy between two water molecules using the supermolecular approach: ΔE = E_AB - E_A - E_B.

<Tutorial
  title="Basic Water Dimer Interaction Energy"
  description="Calculate the interaction energy between two water molecules using HF/3-21G to understand hydrogen bonding."
>
  <Step id="setup" title="Navigate to the basic directory">
    <Instructions>
      <p>Navigate to the directory containing the water molecule geometries and set up for the calculation.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`cd awscc_workshop_2025/01_pair_energies/basic/
ls -la *.xyz`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>A.xyz  B.xyz  AB.xyz</code></pre>
    </Output>
    
    <Notes>
      <p>A.xyz and B.xyz contain individual water molecules, AB.xyz contains the dimer.</p>
    </Notes>
  </Step>

  <Step id="check_geometry" title="Examine the molecular geometries">
    <Instructions>
      <p>Look at the structure files to understand the system. The dimer has a hydrogen bond between the two water molecules.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`cat A.xyz
echo "---"
cat AB.xyz`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`3
Water molecule A
O   -0.702196054  -0.056060256   0.009942262
H   -1.022193224   0.846775782  -0.011488714
H    0.257521062   0.042121496   0.005218999
---
6
Water dimer A-B
O   -0.702196054  -0.056060256   0.009942262
H   -1.022193224   0.846775782  -0.011488714
H    0.257521062   0.042121496   0.005218999
O    2.220871067   0.026716792   0.000620476
H    2.597492682  -0.411663274   0.766744858
H    2.593135384  -0.449496183  -0.744782026`}</code></pre>
    </Output>
    
    <Notes>
      <p>The O-O distance is about 2.9 Å, typical for hydrogen-bonded water.</p>
    </Notes>
  </Step>

  <Step id="run_calculation" title="Run the interaction energy calculation">
    <Instructions>
      <p>Execute the script that calculates energies for A, B, and AB, then computes the interaction energy.</p>
    </Instructions>
    
    <Commands>
      <pre><code>./run_water_dimer.sh</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`Using OCC with method=hf, basis=3-21g

A: total                                -75.585366019097
B: total                                -75.585366020641
AB: total                               -151.176903148648

Interaction Energy:
  ΔE = -0.006171109 hartree
  ΔE = -16.20 kJ/mol`}</code></pre>
    </Output>
    
    <Notes>
      <p>The negative interaction energy indicates attractive interaction (hydrogen bonding).</p>
    </Notes>
  </Step>

  <Step id="analyze_components" title="Understanding the interaction">
    <Instructions>
      <p>The -16.20 kJ/mol interaction energy represents the hydrogen bond strength at HF/3-21G level. Let's verify this calculation manually.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`python3 -c "
E_A = -75.585366019097
E_B = -75.585366020641
E_AB = -151.176903148648
E_int = E_AB - E_A - E_B
print(f'E_int = {E_int:.9f} hartree')
print(f'E_int = {E_int * 2625.4996:.2f} kJ/mol')
print(f'E_int = {E_int * 627.509:.2f} kcal/mol')
"`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`E_int = -0.006171109 hartree
E_int = -16.20 kJ/mol
E_int = -3.87 kcal/mol`}</code></pre>
    </Output>
    
    <Notes>
      <p>Typical hydrogen bond energies are 10-40 kJ/mol, so this is within expected range.</p>
    </Notes>
  </Step>

  <Step id="advanced_options" title="Try different methods">
    <Instructions>
      <p>You can rerun with different methods and basis sets to see how the interaction energy changes.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`# For better accuracy with OCC:
./run_water_dimer.sh --method b3lyp --basis 6-31g

# For quick semi-empirical with xTB:
./run_water_dimer.sh --program xtb --method gfn2`}</code></pre>
    </Commands>
    
    <Notes>
      <p>Higher-level methods typically give interaction energies around -20 to -25 kJ/mol for water dimer.</p>
    </Notes>
  </Step>
</Tutorial>

### Exercise 2: Basis Set Superposition Error (BSSE) Correction

When calculating interaction energies, basis set superposition error (BSSE) can lead to overestimation of binding. The Boys-Bernardi counterpoise correction addresses this by using ghost atoms to ensure consistent basis sets.

<Tutorial
  title="BSSE Correction with Counterpoise Method"
  description="Calculate BSSE-corrected interaction energy for water dimer using the Boys-Bernardi counterpoise procedure with ORCA."
>
  <Step id="setup" title="Navigate to the BSSE directory">
    <Instructions>
      <p>Navigate to the BSSE directory and examine the multi-job input file that performs all necessary calculations.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`cd ../BSSE/
ls -la
head -20 bsse.inp`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`# Calculations for Boys-Bernardi CP correction
#

# --------------------------------------------
# First the monomer. In principle, you only need
# to run it once, but we keep it for clarity.
# --------------------------------------------
! wb97x def2-qzvp VeryTightSCF PModel
%id "monomer"
* xyz 0 1
O   -0.702196054  -0.056060256   0.009942262
H   -1.022193224   0.846775782  -0.011488714
H    0.257521062   0.042121496   0.005218999
*`}</code></pre>
    </Output>
    
    <Notes>
      <p>The file contains 5 calculations: 2 monomers, 1 dimer, and 2 ghost calculations. Note the high-quality basis set (def2-qzvp).</p>
    </Notes>
  </Step>

  <Step id="examine_ghost" title="Understand ghost atoms">
    <Instructions>
      <p>Look at the ghost atom calculations. Ghost atoms (marked with :) provide basis functions without electrons.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`grep -A8 "monomer_ghost" bsse.inp | head -20`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`%id "monomer_ghost"
* xyz 0 1
O   -0.702196054  -0.056060256   0.009942262
H   -1.022193224   0.846775782  -0.011488714
H    0.257521062   0.042121496   0.005218999
O:   2.220871067   0.026716792   0.000620476
H:   2.597492682  -0.411663274   0.766744858
H:   2.593135384  -0.449496183  -0.744782026 
*`}</code></pre>
    </Output>
    
    <Notes>
      <p>The : after atom symbols denotes ghost atoms. This gives monomer A access to monomer B's basis functions.</p>
    </Notes>
  </Step>

  <Step id="run_calculation" title="Run the BSSE calculation">
    <Instructions>
      <p>Execute the BSSE calculation script. This will run all 5 jobs sequentially.</p>
    </Instructions>
    
    <Commands>
      <pre><code>./run_bsse.sh</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`Running ORCA BSSE calculation...

BSSE calculation completed. Results saved to bsse.stdout
Extract energies from the output to calculate BSSE-corrected interaction energy:
  E_int_uncorrected = E_dimer - E_monomer1 - E_monomer2
  E_int_corrected = E_dimer - E_monomer1_ghost - E_monomer2_ghost
  BSSE = E_int_uncorrected - E_int_corrected`}</code></pre>
    </Output>
    
    <Notes>
      <p>The calculation takes longer due to the large basis set and multiple jobs.</p>
    </Notes>
  </Step>

  <Step id="extract_energies" title="Extract energies from output">
    <Instructions>
      <p>Extract the final energies from each calculation to compute BSSE correction.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`grep -A1 "Job-Name" bsse.stdout | grep -B1 "FINAL SINGLE" | grep -E "Job-Name|FINAL"`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`Job-Name: monomer
FINAL SINGLE POINT ENERGY       -76.062213054486
Job-Name: monomer
FINAL SINGLE POINT ENERGY       -76.062213055021
Job-Name: dimer
FINAL SINGLE POINT ENERGY      -152.130903935775
Job-Name: monomer_ghost
FINAL SINGLE POINT ENERGY       -76.062431632384
Job-Name: monomer_ghost
FINAL SINGLE POINT ENERGY       -76.062431633266`}</code></pre>
    </Output>
    
    <Notes>
      <p>We have two monomer calculations (should be identical), one dimer, and two ghost calculations.</p>
    </Notes>
  </Step>

  <Step id="calculate_bsse" title="Calculate BSSE correction">
    <Instructions>
      <p>Calculate both uncorrected and BSSE-corrected interaction energies to see the effect of BSSE.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`python3 -c "
# Energies from the calculations
E_A = -76.062213054486  # Monomer A
E_B = -76.062213055021  # Monomer B  
E_AB = -152.130903935775  # Dimer
E_A_ghost = -76.062431632384  # A with ghost B
E_B_ghost = -76.062431633266  # B with ghost A

# Uncorrected interaction energy
E_int_uncor = E_AB - E_A - E_B
print(f'Uncorrected interaction energy:')
print(f'  ΔE = {E_int_uncor:.6f} hartree = {E_int_uncor * 2625.5:.2f} kJ/mol')

# BSSE-corrected interaction energy  
E_int_cor = E_AB - E_A_ghost - E_B_ghost
print(f'\\nBSSE-corrected interaction energy:')
print(f'  ΔE = {E_int_cor:.6f} hartree = {E_int_cor * 2625.5:.2f} kJ/mol')

# BSSE magnitude
BSSE = E_int_uncor - E_int_cor
print(f'\\nBSSE correction:')
print(f'  BSSE = {BSSE:.6f} hartree = {BSSE * 2625.5:.2f} kJ/mol')
print(f'  BSSE = {abs(BSSE/E_int_uncor)*100:.1f}% of uncorrected energy')
"`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`Uncorrected interaction energy:
  ΔE = -0.006478 hartree = -17.01 kJ/mol

BSSE-corrected interaction energy:
  ΔE = -0.006041 hartree = -15.86 kJ/mol

BSSE correction:
  BSSE = -0.000437 hartree = -1.15 kJ/mol
  BSSE = 6.8% of uncorrected energy`}</code></pre>
    </Output>
    
    <Notes>
      <p>Even with def2-qzvp, BSSE is ~7% of the interaction energy. Smaller basis sets would show larger BSSE.</p>
    </Notes>
  </Step>

  <Step id="analysis" title="Understanding BSSE effects">
    <Instructions>
      <p>BSSE artificially stabilizes the dimer because each monomer "borrows" basis functions from its partner. The counterpoise correction removes this artifact.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`echo "Summary of BSSE correction:"
echo "1. Uncorrected: Each monomer in dimer has more basis functions available"
echo "2. Corrected: Ghost atoms ensure consistent basis set size"
echo "3. True interaction energy = -15.86 kJ/mol (not -17.01 kJ/mol)"
echo "4. BSSE decreases with basis set size but never fully vanishes"`}</code></pre>
    </Commands>
    
    <Notes>
      <p>For publication-quality results, always include BSSE correction for intermolecular interactions.</p>
    </Notes>
  </Step>
</Tutorial>

### Exercise 3: CE-1P Pairwise Interaction Model

The CE-1P (Coupled Electron Pair - 1st order) model provides physically motivated decomposition of interaction energies into electrostatic, exchange, polarization, and dispersion components, useful for understanding the nature of intermolecular interactions.

<Tutorial
  title="CE-1P Interaction Energy Decomposition"
  description="Calculate and decompose water dimer interaction energy using the CE-1P model in OCC to understand the physical components of hydrogen bonding."
>
  <Step id="setup" title="Navigate to the CE1P directory">
    <Instructions>
      <p>Navigate to the CE1P directory and examine the structure. CE-1P requires wavefunction files from SCF calculations.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`cd ../CE1P/
ls -la
cat README.md | head -10`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`A.xyz  B.xyz  AB.xyz  A.owf.json  run_ce1p.sh  translate.toml  README.md

This folder contains an example of the CE1P pairwise model interaction energy decomposition.

The script will:
1. Run SCF calculations on monomers A and B
2. Generate wavefunction files (.owf.json)
3. Run CE-1P decomposition`}</code></pre>
    </Output>
    
    <Notes>
      <p>The .owf.json files store wavefunctions needed for the CE-1P analysis.</p>
    </Notes>
  </Step>

  <Step id="examine_structures" title="Check molecular geometries">
    <Instructions>
      <p>Verify we're using the same water dimer geometry as before for consistency.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`head -4 A.xyz B.xyz
echo "---"
wc -l *.xyz`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`==> A.xyz <==
3
Water molecule A
O   -0.702196054  -0.056060256   0.009942262
H   -1.022193224   0.846775782  -0.011488714

==> B.xyz <==
3
Water molecule B
O    2.220871067   0.026716792   0.000620476
H    2.597492682  -0.411663274   0.766744858
---
  3 A.xyz
  3 B.xyz
  6 AB.xyz`}</code></pre>
    </Output>
    
    <Notes>
      <p>Same water dimer system - this ensures we can compare results across methods.</p>
    </Notes>
  </Step>

  <Step id="run_ce1p" title="Run CE-1P calculation">
    <Instructions>
      <p>Execute the CE-1P script which performs SCF calculations and then the interaction analysis.</p>
    </Instructions>
    
    <Commands>
      <pre><code>./run_ce1p.sh</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`Running OCC CE-1P calculation with method=wb97x, basis=def2-svp, threads=1

Running monomer A calculation...
Running monomer B calculation...

Running CE-1P pair interaction calculation...
  
Coulomb:        -14.36 kJ/mol
Exchange:       -34.19 kJ/mol  
Polarization:    -7.46 kJ/mol
Dispersion:      -2.53 kJ/mol
Total:          -29.10 kJ/mol`}</code></pre>
    </Output>
    
    <Notes>
      <p>CE-1P provides physical insight into what drives the interaction.</p>
    </Notes>
  </Step>

  <Step id="analyze_components" title="Understand interaction components">
    <Instructions>
      <p>Let's analyze each component to understand the physics of hydrogen bonding in water.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`# Extract detailed output from pair.stdout
grep -A20 "Pairwise CE" pair.stdout | grep -E "Coulomb|Exchange|Polarization|Dispersion|Total"`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`  Coulomb                         -0.005469   -14.36
  Exchange-Coulomb                -0.013023   -34.19
  Polarization                    -0.002842    -7.46
  Dispersion                      -0.000963    -2.53
  Total CE-1P                     -0.011081   -29.10`}</code></pre>
    </Output>
    
    <Notes>
      <p>Values shown in hartree and kJ/mol. Exchange-repulsion actually includes attractive exchange-Coulomb in CE-1P.</p>
    </Notes>
  </Step>

  <Step id="component_analysis" title="Physical interpretation">
    <Instructions>
      <p>Analyze the relative importance of each interaction component for hydrogen bonding.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`python3 -c "
# CE-1P components in kJ/mol
coulomb = -14.36
exchange = -34.19  
polarization = -7.46
dispersion = -2.53
total = -29.10

print('Component analysis for water dimer hydrogen bond:')
print(f'{"Component":<15} {"Energy (kJ/mol)":>15} {"% of Total":>12}')
print('-' * 45)
print(f'{"Coulomb":<15} {coulomb:>15.2f} {coulomb/total*100:>11.1f}%')
print(f'{"Exchange":<15} {exchange:>15.2f} {exchange/total*100:>11.1f}%')
print(f'{"Polarization":<15} {polarization:>15.2f} {polarization/total*100:>11.1f}%')  
print(f'{"Dispersion":<15} {dispersion:>15.2f} {dispersion/total*100:>11.1f}%')
print('-' * 45)
print(f'{"Total":<15} {total:>15.2f} {100.0:>11.1f}%')

print('\\nPhysical insights:')
print('- Exchange-Coulomb dominates (117%), providing most attraction')
print('- Classical Coulomb adds 49% attraction')  
print('- Polarization (25%) shows importance of charge redistribution')
print('- Dispersion is minor (9%) for H-bonds vs. van der Waals')
"`}</code></pre>
    </Commands>
    
    <Output>
      <pre><code>{`Component analysis for water dimer hydrogen bond:
Component        Energy (kJ/mol)   % of Total
---------------------------------------------
Coulomb                  -14.36        49.3%
Exchange                 -34.19       117.5%
Polarization              -7.46        25.6%
Dispersion                -2.53         8.7%
---------------------------------------------
Total                    -29.10       100.0%

Physical insights:
- Exchange-Coulomb dominates (117%), providing most attraction
- Classical Coulomb adds 49% attraction  
- Polarization (25%) shows importance of charge redistribution
- Dispersion is minor (9%) for H-bonds vs. van der Waals`}</code></pre>
    </Output>
    
    <Notes>
      <p>The exchange term in CE-1P includes penetration effects, making it attractive for hydrogen bonds.</p>
    </Notes>
  </Step>

  <Step id="compare_methods" title="Compare with other results">
    <Instructions>
      <p>Compare CE-1P results with our previous calculations to see method dependence.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`echo "Comparison of water dimer interaction energies:"
echo "Method               Basis        Energy (kJ/mol)"
echo "------------------------------------------------"
echo "HF                   3-21G            -16.20"
echo "ωB97X (BSSE-corr)    def2-QZVP        -15.86"  
echo "CE-1P/ωB97X          def2-SVP         -29.10"
echo ""
echo "CE-1P gives stronger binding due to:"
echo "1. Better treatment of electron correlation"
echo "2. Explicit polarization and dispersion"
echo "3. Different basis set (def2-SVP vs others)"`}</code></pre>
    </Commands>
    
    <Notes>
      <p>CE-1P typically gives more accurate interaction energies than HF, approaching CCSD(T) quality.</p>
    </Notes>
  </Step>

  <Step id="advanced_usage" title="Try different systems">
    <Instructions>
      <p>You can modify the molecular files to study different interactions and see how components change.</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`# For different methods/basis:
./run_ce1p.sh --method pbe --basis def2-tzvp

# CE-1P excels at revealing interaction types:
# - Ionic: Coulomb dominates
# - H-bonds: Exchange-Coulomb + Coulomb dominate  
# - vdW: Dispersion dominates
# - π-π: Mix of dispersion and exchange`}</code></pre>
    </Commands>
    
    <Notes>
      <p>CE-1P decomposition helps in understanding and designing molecular interactions.</p>
    </Notes>
  </Step>
</Tutorial>

### Method Comparison Summary

| Method | Binding Energy (kJ/mol) | Time | Key Advantage |
|--------|------------------------|------|---------------|
| **HF/3-21G** | -16.20 | ~0.5 sec | Very fast, but poor accuracy |
| **ωB97X (BSSE-corr)** | -15.86 | ~1 min | Systematic improvability, well benchmarked |
| **CE-1P/ωB97X** | -29.10 | &lt;0.5 sec | Cheap, accurate, physical insight |

**Why do the methods give different binding energies?**
- **HF/3-21G** underestimates binding due to small basis set and lack of correlation
- **ωB97X w/BSSE** provides good balance, but limited by basis set quality
- **CE-1P** includes all physical components explicitly, giving more accurate results

**Key physical insights for water dimer:**
1. **Exchange-Coulomb dominates** (117% of binding) - quantum penetration effects
2. **Classical Coulomb** contributes significantly (49%) - charge-charge interactions
3. **Polarization** is important (26%) - charge redistribution upon binding
4. **Dispersion** is modest (9%) but essential for accurate binding

## Computational Considerations

Modern calculations often use:
1. **DFT with dispersion corrections** (e.g., wb97x-D4)
2. **Composite methods like double-hybrid functionals, MP2 or CCSD(T)** for benchmark accuracy
3. **Force fields** for large systems (1000s of atoms)

## Key Takeaways

✓ **Thermodynamic foundations**: Binding energy connects to thermodynamics through Hess's law

✓ **Four(ish) fundamental interactions to consider**: Electrostatic, exchange-repulsion, polarization, and dispersion govern intermolecular interactions

✓ **Distance dependence**: Each force has distinct distance dependence and physical origin

✓ **Complex interplay**: Real molecules exhibit complex interplay of all forces

✓ **Computational methods**: Must account for dispersion, things like BSSE

✓ **Method choice matters**: Speed vs. accuracy trade-offs for different applications. Error cancellation means a 'better' method isn't always better.

## Suggested Extension: Advanced Energy Decomposition with LED

:::info[Advanced Energy Decomposition with LED]

For those interested in a more sophisticated energy decomposition analysis, Local Energy Decomposition (LED) provides detailed insights into intermolecular interactions at the coupled cluster level.

### Local Energy Decomposition (LED) Analysis

LED decomposes DLPNO-CCSD(T) energies into physically meaningful components. This method is available in ORCA and provides highly accurate interaction energies with detailed breakdowns.

**Important**: LED analysis requires **three separate calculations**:

1. **Dimer with LED**: Full complex with LED decomposition
2. **Monomer A**: Isolated water molecule A at its geometry in the dimer
3. **Monomer B**: Isolated water molecule B at its geometry in the dimer

```bash
# The complete LED workflow:
orca led_dimer.inp > led_dimer.stdout  # Dimer with LED
orca led_a.inp > led_a.stdout          # Water A at dimer geometry
orca led_b.inp > led_b.stdout          # Water B at dimer geometry
```

**The interaction energy components are calculated as:**
- **ΔE(component) = E(dimer) - E(monomer A) - E(monomer B)**

**Energy breakdown (kJ/mol) - water dimer example:**

| Component | Energy | Physical Origin |
|-----------|--------|-----------------|
| **Electrostatic** | -93.09 | Charge-charge interactions |
| **Exchange** | -15.31 | Quantum stabilization from antisymmetrization |
| **Dispersion** | -3.03 | London forces from electron correlation |
| **Total binding** | **-28.95** | Full CCSD(T) binding energy |

Notice how different the breakdown of some components is compared to CE-1p. This highlights why it's important to understand *how* the breakdown (or construction) is performed before interpretation. LED provides a more rigorous quantum mechanical decomposition but at significantly higher computational cost.

**When to use LED:**
- When you need highly accurate binding energies
- For benchmarking other methods
- When detailed understanding of electron correlation effects is required
- For publication-quality energy decomposition analysis

The LED method includes more correlation effects than DFT or semi-empirical methods, typically giving stronger binding energies and more detailed insights into the nature of intermolecular interactions.

:::
