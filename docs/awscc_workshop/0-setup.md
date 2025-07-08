---
sidebar_position: 1
---

# 0. Setup (10 minutes)

Welcome to the AWSCC 2025 Workshop on Intermolecular Interactions! This setup guide will get you ready for the hands-on exercises.

## Quick Start

The [GitHub repository](https://github.com/peterspackman/awscc2025) for this workshop is the best starting point.

For this workshop, you'll need:
- **[OCC](https://github.com/peterspackman/occ/releases)** (Open Computational Chemistry) - for interaction energy calculations
- **[XTB](https://github.com/grimme-lab/xtb)** (eXtended Tight-Binding) - for fast quantum calculations
- **Optional:** ORCA for advanced calculations (not strictly required but very valuable)
- **Visualization:** up to you - CrystalExplorer, Avogadro, Ovito, ChimeraX etc..

Some of those are installable via the scripts in the
[GitHub repository](https://github.com/peterspackman/awscc2025), but if you
wish to manually install them there are instructions below for `occ` and `xtb` binaries.

## Test Your Setup

1. **Download workshop materials:**
   ```bash
   git clone https://github.com/peterspackman/awscc2025
   cd awscc2025
   ```

2. **Quick test:**
   ```bash
   cd 01_pair_energies/CE1P
   occ scf A.xyz
   ```

   You should see energy output starting with:
   ```bash
         Open
          \
           Comp
            \
             Chem

   ...

   ===============================  Input  ================================
   Method string                         rhf
   Basis name                          3-21G
   Shell kind                      Cartesian
   Net charge                              0
   Multiplicity                            1
   ...
   starting restricted scf iterations
      #         E (Hartrees)       |dE|/E max|FDS-SDF|     T (s)
      1     -75.570107464680  6.47837e-04  5.31104e-02  9.36e-04
      2     -75.584244262199  1.66824e-04  1.96361e-02  8.12e-04
      3     -75.585159528009  1.08006e-05  7.07734e-03  7.40e-04
      4     -75.585320852140  1.90371e-06  1.23457e-03  6.68e-04
      5     -75.585325637001  5.64638e-08  1.10974e-04  6.67e-04
      6     -75.585325703965  7.90206e-10  6.89991e-06  6.89e-04

   ...
   ```

### Other Installation Options

#### OCC Installation and usage via CLI (recommended)
```bash
# Download from GitHub releases
# https://github.com/peterspackman/occ/releases
export OCC_DATA_PATH=/path/to/occ/share/folder
occ --help
```

**Important**: Set the `OCC_DATA_PATH` environment variable:
```bash
export OCC_DATA_PATH=/path/to/occ/data
```

#### OCC install via pip or uv
```
pip install occpy
occpy --help

# For uv users
uv tool run occpy --help
```


#### XTB Installation
`xtb` can be installed via compilation of the source code, pre-built binary releases, conda etc.
```bash
# Install with conda
conda install -c conda-forge xtb

# Or with pip
pip install xtb-python


```

### Additional Software

Some examples also use **ORCA** for calculations, though I've tried to make them optional where I can:
- Register and download from [ORCA Forum](https://orcaforum.kofo.mpg.de/app.php/portal)
- Free for academic use
- Also pre-installed on GADI (requires registration and NCI `orca` group membership)



## Visualization Tools

Use your preferred program for viewing molecular and crystal structures:

### CrystalExplorer (Recommended)
 Download a **development release** from [here](https://github.com/peterspackman/crystalexplorer/releases/)

### Alternatives
- **[Ovito](https://www.ovito.org/)** - Excellent for large systems and trajectories
- **[VESTA](https://jp-minerals.org/vesta/en/)** - Great for crystal structures
- **Avogadro**, **PyMOL**, **ChimeraX**, whatever works for you

## Workshop Structure

We'll cover three main topics in 1.5 hours:

1. **Pair energies/molecular dimers** - Understanding two-molecule interactions
2. **Clusters** - Moving to multi-molecule systems  
3. **Crystal Growth and solvation** - Simulating how crystals form

## Troubleshooting

### Common Issues

1. `command not found` - Check your `PATH` variable path
2. **Memory errors** - Use smaller basis sets or reduce system size
3. **Slow calculations** - Normal for large systems, we have pre-computed results

### Getting Help

- Ask a question!
- Check the [OCC Wiki](https://github.com/peterspackman/occ/wiki)
- Example outputs are in each exercise folder

## Extra: Setting Up Your Own Calculations

If you want to prepare your own molecules:

### Getting a structure:
   - Download from [Cambridge Structural Database](https://www.ccdc.cam.ac.uk)
   - Manually edit a geometry file or build in a GUI program like Avogadro/GaussView
   - Extract from a crystal structure (might need to add hydrogens, deal with disorder...) [Mercury](https://www.ccdc.cam.ac.uk/solutions/software/free-mercury/) is good for this.
   - Generate conformers from e.g. SMILES strings (lots of options)


### Visualize in CrystalExplorer:**
   - Open the `.cif` or `.xyz` file
   - Use "Intermolecular Interactions" tool
   - Color by interaction energy

Ready? Let's explore the fascinating world of intermolecular interactions!
