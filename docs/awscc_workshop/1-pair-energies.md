---
sidebar_position: 2
---

import WaterDimerEnergy from '@site/src/components/WaterDimerEnergy';
import Figure from '@site/src/components/Figure';
import { Tutorial, Step, Instructions, Commands, Output, Notes } from '@site/src/components/HandsOnExample';

# 1. Intermolecular Interactions: From Theory to Practice

Much of chemistry and materials science involves condensed matter, that is to intermolecular interactions (or perhaps more accurately non-bonded interactions). Understanding these interactions is therefore fundamental to many applications of computational chemistry. Since theoretical and computational chemistry is generally focused on getting the best answer in a tractable amount of computer time, it's essential to know which kinds of interactions are important for which systems, and cheap and dirty can we be in their approximation when explaining or predicting some observable phenomenon.

## Gibbs Free Energy vs. Enthalpy

To cut a very long story short, we can start with the Gibbs free energy to determine whether molecular association is spontaneous under given conditions ($T$, $P$). Recall that the Gibbs free energy combines energetic and entropic contributions:

<div style={{textAlign: 'center'}}>

$$ \Delta G = \Delta H - T \Delta S$$

</div>

Or more explicitly:

<div style={{textAlign: 'center'}}>

$$\Delta G_{\text{dimer}} = \Delta H_{\text{dimer}} - T\Delta S_{\text{dimer}}$$

</div>

In practice, we're often primarily concerned with predicting the enthalpy contribution because:

1. **Entropy is quite often similar across related systems** - For comparing similar binding modes, $\Delta S$ varies less than $\Delta H$ (and $\Delta S$ can be much harder to model...)
2. **Low temperatures reduce entropic contributions** - At cryogenic crystal structure conditions, $T\Delta S$ becomes small
3. **Enthalpy dominates strong interactions** - For hydrogen bonds and ionic interactions, $|\Delta H| >> |T\Delta S|$
4. **Computational efficiency** - Energy calculations on a static system directly yield energies related to enthalpy (at least much of the energy)

### Hess's law: Enthalpy is path-independent

For a given molecular dimer or pair for example, this means that *regardless of how they came to be in a given configuration* we can calculate the enthalpy as:

<div style={{textAlign: 'center'}}>

$$\Delta H_{\text{binding}} = H_{\text{dimer}} - H_{\text{monomer A}} - H_{\text{monomer B}}$$

</div>

This can be done via electronic structure calculations, molecular mechanics force fields, tight-binding, machine learned potentials or really any method that computes the total energy for a given system:

<div style={{textAlign: 'center'}}>

$$\Delta E_{\text{binding}} = E_{AB} - E_A - E_B$$

</div>

This binding energy is not the whole picture, there are other enthalpy contributions:

<div style={{textAlign: 'center'}}>

$$\Delta H = \Delta E + \Delta(PV) + \Delta E_{\text{ZPE}} + \Delta E_{\text{thermal}}$$

</div>

For condensed phases and moderate temperatures:
- $\Delta(PV) \approx 0$ (negligible volume change)
- $\Delta E_{\text{thermal}} \approx 0$ (a common assumption)

Therefore:

<div style={{textAlign: 'center'}}>

$$\Delta H \approx \Delta E + \Delta E_{\text{ZPE}}$$

</div>

And often the zero-point energy correction is also small, giving:

<div style={{textAlign: 'center'}}>

$$\Delta H \approx \Delta E$$

</div>

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

<div style={{textAlign: 'center'}}>

$$ E_\text{elec} = \sum_{i<j} \frac{q_i q_j}{r_{ij}}$$

</div>

That is if we just work in atomic units so we can do away with the constant factor of $\frac{1}{4\pi\epsilon_0}$

This is fundamentally important for condensed matter, as it's the longest-range interaction (i.e. slowest to decay to 0), decaying as $1/r$.

If we instead had a multipole series:

<div style={{textAlign: 'center'}}>

$$E_{\text{elec}} = E_{\text{charge-charge}} + E_{\text{charge-dipole}} + E_{\text{dipole-dipole}} + ...$$

</div>

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

<div style={{textAlign: 'center'}}>

$$E_{\text{exch}} \propto \text{exp}(-\alpha r)$$

</div>

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

<div style={{textAlign: 'center'}}>

$$E_{\text{ind}} = -\frac{1}{2}\alpha_B |E_A|^2$$

</div>

where $\alpha_B$ is the polarizability of molecule B. This scales as $r^{-4}$ for charge-induced dipole interactions. While this formula provides a useful approximation, it's important to remember that polarizability is effectively a volume term, and this approach assumes the polarizable volume of a site is spherical/isotropic.

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

<div style={{textAlign: 'center'}}>

$$E_{\text{disp}} = -\frac{3}{2}\frac{I_A I_B}{I_A + I_B}\frac{\alpha_A \alpha_B}{r^6}$$

</div>

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

<div style={{textAlign: 'center'}}>

$$V_{LJ}(r) = 4\epsilon\left[\left(\frac{\sigma}{r}\right)^{12} - \left(\frac{\sigma}{r}\right)^6\right]$$

</div>

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

<div style={{textAlign: 'center'}}>

$$ E_\text{interaction} = E_\text{AB} - E_\text{A} - E_\text{B}$$

</div>

i.e. we'd need 3 calculations, one for each monomer and one for the pair!

**However**, in the case of isolated molecules we also need to relax (geometry optimise) each component individually in order to have a fair comparison and an accurate interaction energy.

:::warning[About geometry optimisation]
Throughout these exercises we're going to ignore the relaxation aspect of interactions. It **is** important, but it makes the calculations take longer and it's just more things to worry about for now. So just pretend it's all there, but keep in mind for the future especially for flexible molecules this can be a major component of the energy.
:::

### Exercise 1: Basic Interaction Energy Calculation

Understanding how molecules interact is fundamental to computational chemistry. We'll calculate the interaction energy between two water molecules using the supermolecular approach: $\Delta E = E_\text{AB} - E_\text{A} - E_\text{B}$.

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

total A                               -75.585325689991
total B                               -75.585361853858
total AB                              -151.187310894789

Interaction Energy:
  ΔE = -0.016623351 hartree
  ΔE = -43.64 kJ/mol`}</code></pre>
    </Output>
    
    <Notes>
      <p>The negative interaction energy indicates attractive interaction (hydrogen bonding). If you're using HF/3-21g like for this one then there's probably a very large error...</p>
    </Notes>
  </Step>

  <Step id="advanced_options" title="Try different methods">
    <Instructions>
      <p>You can rerun with different methods and basis sets to see how the interaction energy changes. If you're using ORCA you may need to modify the inp files directly</p>
    </Instructions>
    
    <Commands>
      <pre><code>{`# For better accuracy with OCC:
./run_water_dimer.sh --method b3lyp --basis def2-tzvp

# For quick semi-empirical with xTB:
./run_water_dimer.sh --program xtb --method gfn2`}</code></pre>
    </Commands>
    
    <Notes>
      <p>Higher-level methods typically give interaction energies around -20 to -25 kJ/mol for water dimer. If you increase the basis set size you should see starkly different behaviour (eventually converging with large basis sets)</p>
    </Notes>
  </Step>
</Tutorial>

### Exercise 2: Basis Set Superposition Error (BSSE) Correction

When calculating interaction energies, basis set superposition error (BSSE) can lead to overestimation of binding. The Boys-Bernardi counterpoise correction addresses this by using ghost atoms to ensure consistent basis sets.

The source of this error is basically that the electrons have more degrees of freedom to relax when the basis set size increases, so if we have a complete basis set for each monomer then there should ideally be no BSSE!.

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
! hf 3-21g VeryTightSCF PModel
%id "monomer"
* xyz 0 1
O   -0.702196054  -0.056060256   0.009942262
H   -1.022193224   0.846775782  -0.011488714
H    0.257521062   0.042121496   0.005218999
*`}</code></pre>
    </Output>
    
    <Notes>
      <p>The file contains 5 calculations: 2 monomers, 1 dimer, and 2 ghost calculations. If we adjust that to a larger basis set we should see smaller BSSE!</p>
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

Extracting energies from BSSE calculation...

=========================================
BSSE CORRECTION ANALYSIS
=========================================

Individual job energies:
  Monomer A:           -75.585325690 hartree
  Monomer B:           -75.585361854 hartree
  Dimer AB:            -151.187310895 hartree
  Monomer A + ghost B: -75.585862918 hartree
  Monomer B + ghost A: -75.591681002 hartree

Interaction energies:
  Uncorrected:    -0.016623 hartree =  -43.64 kJ/mol
  BSSE-corrected: -0.009767 hartree =  -25.64 kJ/mol

BSSE correction:
  BSSE = -0.006856 hartree =  -18.00 kJ/mol
  BSSE = 40.0% of uncorrected interaction energy

Analysis:
  - Small BSSE (<1 kJ/mol) - correction less critical
  - Use BSSE-corrected value for publication
  - BSSE decreases with larger basis sets`}</code></pre>
    </Output>
    
    <Notes>
      <p>The calculation takes longer due to the large basis set and multiple jobs.</p>
    </Notes>
  </Step>

  <Step id="extract_energies" title="Extract energies from output">
    <Instructions>
      <p>The script automatically did this, but you can manually extract the energies yourself and calculate the values to confirm!</p>
    </Instructions>
  </Step>

  <Step id="try_different_basis_sets" title="Try with different basis sets and methods">
    <Instructions>
      <p>Calculate both uncorrected and BSSE-corrected interaction energies to see the effect of BSSE.
      Try it with the following basis sets:</p>
      <ul>
        <li> 6-31G </li>
        <li> def2-svp </li>
        <li> def2-tzvp </li>
        <li> def2-tzvpp </li>
        <li> def2-qzvp </li>
      </ul>
    </Instructions>
    
    <Notes>
      <p>For publication-quality results, always include some sort of BSSE correction (or use a big enough basis set) for intermolecular interactions. There are other counterpoise correctio options e.g. GCP etc.</p>
    </Notes>
  </Step>
</Tutorial>

### Exercise 3: CE-1P Pairwise Interaction Model

The CE-1P (CrystalExplorer - 1 parameter) model provides physically motivated construction of of interaction energies into electrostatic, exchange, repulsion, polarisation, and dispersion components, useful for understanding the nature of intermolecular interactions.

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
      <pre><code>{`Dimer
Component              Energy (kJ/mol)

Coulomb                 -31.569102
Exchange                -27.320883
Repulsion                50.248193
Polarization             -4.068470
Dispersion               -1.755652
__________________________________
Total                   -24.694522`}</code></pre>
    </Output>
    
    <Notes>
      <p>CE-1P provides physical insight into what drives the interaction.</p>
    </Notes>
  </Step>

  <Step id="component_analysis" title="Physical interpretation">
    <Instructions>
      <p>Analyze the relative importance of each interaction component for hydrogen bonding. Refer to the <a href="./ce-1p">CE-1p appendix</a> for more information</p>
      <pre><code>{`Dimer
Component              Energy (kJ/mol)

Coulomb                 -31.569102
Exchange                -27.320883
Repulsion                50.248193
Polarization             -4.068470
Dispersion               -1.755652
__________________________________
Total                   -24.694522`}</code></pre>
    </Instructions>
  </Step>
    
  <Step id="advanced_usage" title="Try different methods and basis sets">
    <Instructions>
      <p>You can modify the molecular files to study different interactions and see how components change.</p>

      <pre><code>{`# For different methods/basis:
./run_ce1p.sh --method pbe --basis def2-tzvp

# CE-1P is quite an accurate method at low cost and helps reveal dominant interactions:
# - Ionic: Coulomb dominates
# - H-bonds: Exchange-Coulomb + Coulomb dominate  
# - vdW: Dispersion dominates
# - π-π: Mix of dispersion and exchange`}</code></pre>
    </Instructions>
    
    <Notes>
      <p>CE-1P decomposition helps in understanding and designing molecular interactions.</p>
    </Notes>
  </Step>
</Tutorial>

### Method Comparison Summary

| Method | Binding Energy (kJ/mol) | Time | Key Advantage |
|--------|------------------------|------|---------------|
| **HF/3-21G** | -43.64 | ~0.5 sec | Very fast, but poor accuracy |
| **HF/3-21G (BSSE-corr)** | -25.64 | ~7 s | Systematic improvability, well benchmarked |
| **CE-1P (ωB97X/def2-SVP)** | -24.69 | &lt;0.5 sec | Cheap, accurate, physical insight |

**Why do the methods give different binding energies?**
- **HF/3-21G** the direct supermolecule method overestimates binding due to small basis set (BSSE)
- **HF/3-21G w/BSSE** provides good balance, but can be very expensive for larger dimers
- **CE-1P** includes all physical components explicitly, giving more accurate results

**Key physical insights for water dimer:**
1. **Coulomb dominates** (117% of binding) - quantum penetration effects
2. **Dispersion** is modest (9%) but probably essential for accurate binding

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

You can check this out in the `LED` directory, or looking at the [ORCA documentation](https://www.faccts.de/docs/orca/6.0/manual/contents/typical/properties.html#example-led-analysis-of-intermolecular-interactions)

:::
