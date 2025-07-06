---
sidebar_position: 2
---

import { UnitCellViewer3D, UnitCellProvider, UnitCellControls, UnitCellMatrixDisplay } from '@site/src/components/UnitCell';
import { CRYSTAL_SYSTEMS } from '@site/src/components/UnitCell/predefinedCells';
import MathFormula from '@site/src/components/MathFormula';

# Lattice Fundamentals

## What is a Lattice?

A **lattice** is a mathematical concept describing a regular, infinite arrangement of points in space. In crystallography, these points represent the repeating positions where atoms, molecules, or groups of atoms (motifs) can be placed.


:::info Mathematical Definition

A lattice **L** is the set of all points that can be expressed as:

<MathFormula 
  math={String.raw`\mathbf{r} = n_1\mathbf{a} + n_2\mathbf{b} + n_3\mathbf{c}`}
  inline={false}
/>

where:
- **a**, **b**, **c** are the **lattice vectors** (linearly independent)
- n₁, n₂, n₃ are integers
- **r** is any lattice point

:::

## Lattice vs Crystal Structure

It's crucial to distinguish between these concepts:

| | Concept | Properties |
|---------|-------------|------------|
| **Lattice (Abstract)** | Mathematical points in space | Defined by lattice vectors, Pure geometry, 14 Bravais lattices possible |
| **Crystal Structure (Physical)** | Atoms at specific positions | Lattice + motif/basis, Physical properties, Infinite structural variety |

:::warning Important Distinction
**Atoms are not lattice points.** Atomic positions in a crystal are not necessarily lattice points - though they may coincide. Lattice points are mathematical abstractions that define the repeating pattern, while atoms occupy specific positions that may be offset from these points.
:::


## Mathematical Properties

### Lattice Vector Matrix

The three lattice vectors form a **lattice matrix**:

<MathFormula 
  math={String.raw`\mathbf{M} = [\mathbf{a}, \mathbf{b}, \mathbf{c}] = \begin{pmatrix} a_x & b_x & c_x \\ a_y & b_y & c_y \\ a_z & b_z & c_z \end{pmatrix}`}
  inline={false}
/>

### Coordinate Transformations

The lattice matrix enables conversion between **fractional coordinates** (relative to lattice vectors) and **Cartesian coordinates** (absolute positions in space):

<MathFormula 
  math={String.raw`\begin{pmatrix} x \\ y \\ z \end{pmatrix}_{cart} = \mathbf{M} \begin{pmatrix} u \\ v \\ w \end{pmatrix}_{frac} = u\mathbf{a} + v\mathbf{b} + w\mathbf{c}`}
  inline={false}
/>

**Example:** For a cubic lattice with **a** = **b** = **c** = 2.5 Å and 90° angles:

<MathFormula 
  math={String.raw`\mathbf{M} = \begin{pmatrix} 2.5 & 0 & 0 \\ 0 & 2.5 & 0 \\ 0 & 0 & 2.5 \end{pmatrix}`}
  inline={false}
/>

A point at fractional coordinates (0.5, 0.5, 0.5) converts to:

<MathFormula 
  math={String.raw`\begin{pmatrix} x \\ y \\ z \end{pmatrix} = \begin{pmatrix} 2.5 & 0 & 0 \\ 0 & 2.5 & 0 \\ 0 & 0 & 2.5 \end{pmatrix} \begin{pmatrix} 0.5 \\ 0.5 \\ 0.5 \end{pmatrix} = \begin{pmatrix} 1.25 \\ 1.25 \\ 1.25 \end{pmatrix} \text{ Å}`}
  inline={false}
/>

### Inverse Transformation

To convert from Cartesian to fractional coordinates, we use the **inverse lattice matrix**:

<MathFormula 
  math={String.raw`\begin{pmatrix} u \\ v \\ w \end{pmatrix}_{frac} = \mathbf{M}^{-1} \begin{pmatrix} x \\ y \\ z \end{pmatrix}_{cart}`}
  inline={false}
/>

The inverse matrix **M⁻¹** has **reciprocal lattice vectors** as its rows:

<MathFormula 
  math={String.raw`\mathbf{M}^{-1} = \frac{1}{V} \begin{pmatrix} \mathbf{b} \times \mathbf{c} \\ \mathbf{c} \times \mathbf{a} \\ \mathbf{a} \times \mathbf{b} \end{pmatrix}^T`}
  inline={false}
/>

where **V** = det(**M**) is the unit cell volume.

**Continuing the example:** For the cubic case:

<MathFormula 
  math={String.raw`\mathbf{M}^{-1} = \begin{pmatrix} 0.4 & 0 & 0 \\ 0 & 0.4 & 0 \\ 0 & 0 & 0.4 \end{pmatrix}`}
  inline={false}
/>

Converting the Cartesian point (1.0, 2.0, 1.5) Å back to fractional coordinates:

<MathFormula 
  math={String.raw`\begin{pmatrix} u \\ v \\ w \end{pmatrix} = \begin{pmatrix} 0.4 & 0 & 0 \\ 0 & 0.4 & 0 \\ 0 & 0 & 0.4 \end{pmatrix} \begin{pmatrix} 1.0 \\ 2.0 \\ 1.5 \end{pmatrix} = \begin{pmatrix} 0.4 \\ 0.8 \\ 0.6 \end{pmatrix}`}
  inline={false}
/>

### Unit Cell Volume

The volume of the unit cell (fundamental parallelepiped) is:

<MathFormula 
  math={String.raw`V = \mathbf{a} \cdot (\mathbf{b} \times \mathbf{c}) = \det(\mathbf{M})`}
  inline={false}
/>

# The Seven Lattice Systems

Constraints on the lattice vectors lead to seven distinct **lattice systems**, classified by their metric symmetry:

## Bravais Lattices

Each lattice system can have different **centering types**, leading to the 14 Bravais lattices:

- **Primitive (P):** Lattice points only at corners
- **Body-centered (I):** Additional point at cell center  
- **Face-centered (F):** Additional points at face centers
- **Base-centered (A, B, C):** Additional points at base centers

Not all combinations are crystallographically distinct, yielding exactly **14 unique Bravais lattices**.


### 1. Triclinic

**Constraints:** None  
**Parameters:** <MathFormula math="a \neq b \neq c, \alpha \neq \beta \neq \gamma \neq 90°" inline={true} />  
**Degrees of freedom:** 6  
**Bravais lattices:** 1

<div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Primitive (P)</div>
    <div style={{ width: '300px', height: '300px' }}>
      <UnitCellProvider initialState={{
        params: CRYSTAL_SYSTEMS.triclinic.params,
        latticeSystem: 'triclinic',
        centeringType: 'P',
        displayOptions: { showGrid: false, showLatticePoints: true, showMatrixInfo: false, showImages: false, autoRotate: true }
      }}>
        <UnitCellViewer3D height="300px" />
      </UnitCellProvider>
    </div>
  </div>
</div>

### 2. Monoclinic

**Constraints:** <MathFormula math="\alpha = \gamma = 90°" inline={true} />  
**Parameters:** <MathFormula math="a \neq b \neq c, \beta \neq 90°" inline={true} />  
**Degrees of freedom:** 4  
**Bravais lattices:** 2

<div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Primitive (P)</div>
    <div style={{ width: '240px', height: '240px' }}>
      <UnitCellProvider initialState={{
        params: CRYSTAL_SYSTEMS.monoclinic.params,
        latticeSystem: 'monoclinic',
        centeringType: 'P',
        displayOptions: { showGrid: false, showLatticePoints: true, showMatrixInfo: false, showImages: false, autoRotate: true }
      }}>
        <UnitCellViewer3D height="240px" />
      </UnitCellProvider>
    </div>
  </div>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Base-centered (C)</div>
    <div style={{ width: '240px', height: '240px' }}>
      <UnitCellProvider initialState={{
        params: CRYSTAL_SYSTEMS.monoclinic.params,
        latticeSystem: 'monoclinic',
        centeringType: 'C',
        displayOptions: { showGrid: false, showLatticePoints: true, showMatrixInfo: false, showImages: false, autoRotate: true }
      }}>
        <UnitCellViewer3D height="240px" />
      </UnitCellProvider>
    </div>
  </div>
</div>

### 3. Orthorhombic

**Constraints:** <MathFormula math="\alpha = \beta = \gamma = 90°" inline={true} />  
**Parameters:** <MathFormula math="a \neq b \neq c" inline={true} />  
**Degrees of freedom:** 3  
**Bravais lattices:** 4

<div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Primitive (P)</div>
    <div style={{ width: '240px', height: '240px' }}>
      <UnitCellProvider initialState={{
        params: CRYSTAL_SYSTEMS.orthorhombic.params,
        latticeSystem: 'orthorhombic',
        centeringType: 'P',
        displayOptions: { showGrid: false, showLatticePoints: true, showMatrixInfo: false, showImages: false, autoRotate: true }
      }}>
        <UnitCellViewer3D height="240px" />
      </UnitCellProvider>
    </div>
  </div>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Body-centered (I)</div>
    <div style={{ width: '240px', height: '240px' }}>
      <UnitCellProvider initialState={{
        params: CRYSTAL_SYSTEMS.orthorhombic.params,
        latticeSystem: 'orthorhombic',
        centeringType: 'I',
        displayOptions: { showGrid: false, showLatticePoints: true, showMatrixInfo: false, showImages: false, autoRotate: true }
      }}>
        <UnitCellViewer3D height="240px" />
      </UnitCellProvider>
    </div>
  </div>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Face-centered (F)</div>
    <div style={{ width: '240px', height: '240px' }}>
      <UnitCellProvider initialState={{
        params: CRYSTAL_SYSTEMS.orthorhombic.params,
        latticeSystem: 'orthorhombic',
        centeringType: 'F',
        displayOptions: { showGrid: false, showLatticePoints: true, showMatrixInfo: false, showImages: false, autoRotate: true }
      }}>
        <UnitCellViewer3D height="240px" />
      </UnitCellProvider>
    </div>
  </div>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Base-centered (C)</div>
    <div style={{ width: '240px', height: '240px' }}>
      <UnitCellProvider initialState={{
        params: CRYSTAL_SYSTEMS.orthorhombic.params,
        latticeSystem: 'orthorhombic',
        centeringType: 'C',
        displayOptions: { showGrid: false, showLatticePoints: true, showMatrixInfo: false, showImages: false, autoRotate: true }
      }}>
        <UnitCellViewer3D height="240px" />
      </UnitCellProvider>
    </div>
  </div>
</div>

### 4. Tetragonal

**Constraints:** <MathFormula math="a = b, \alpha = \beta = \gamma = 90°" inline={true} />  
**Parameters:** <MathFormula math="a = b \neq c" inline={true} />  
**Degrees of freedom:** 2  
**Bravais lattices:** 2

<div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Primitive (P)</div>
    <div style={{ width: '240px', height: '240px' }}>
      <UnitCellProvider initialState={{
        params: CRYSTAL_SYSTEMS.tetragonal.params,
        latticeSystem: 'tetragonal',
        centeringType: 'P',
        displayOptions: { showGrid: false, showLatticePoints: true, showMatrixInfo: false, showImages: false, autoRotate: true }
      }}>
        <UnitCellViewer3D height="240px" />
      </UnitCellProvider>
    </div>
  </div>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Body-centered (I)</div>
    <div style={{ width: '240px', height: '240px' }}>
      <UnitCellProvider initialState={{
        params: CRYSTAL_SYSTEMS.tetragonal.params,
        latticeSystem: 'tetragonal',
        centeringType: 'I',
        displayOptions: { showGrid: false, showLatticePoints: true, showMatrixInfo: false, showImages: false, autoRotate: true }
      }}>
        <UnitCellViewer3D height="240px" />
      </UnitCellProvider>
    </div>
  </div>
</div>

### 5. Hexagonal

**Constraints:** <MathFormula math="a = b, \alpha = \beta = 90°, \gamma = 120°" inline={true} />  
**Parameters:** <MathFormula math="a = b \neq c" inline={true} />  
**Degrees of freedom:** 2  
**Bravais lattices:** 1

<div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Primitive (P)</div>
    <div style={{ width: '300px', height: '300px' }}>
      <UnitCellProvider initialState={{
        params: CRYSTAL_SYSTEMS.hexagonal.params,
        latticeSystem: 'hexagonal',
        centeringType: 'P',
        displayOptions: { showGrid: false, showLatticePoints: true, showMatrixInfo: false, showImages: false, autoRotate: true }
      }}>
        <UnitCellViewer3D height="300px" />
      </UnitCellProvider>
    </div>
  </div>
</div>

### 6. Trigonal (Rhombohedral)

**Constraints:** <MathFormula math="a = b = c, \alpha = \beta = \gamma" inline={true} />  
**Parameters:** All equal lengths and angles  
**Degrees of freedom:** 2  
**Bravais lattices:** 1

<div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Primitive (P)</div>
    <div style={{ width: '300px', height: '300px' }}>
      <UnitCellProvider initialState={{
        params: CRYSTAL_SYSTEMS.trigonal.params,
        latticeSystem: 'trigonal',
        centeringType: 'P',
        displayOptions: { showGrid: false, showLatticePoints: true, showMatrixInfo: false, showImages: false, autoRotate: true }
      }}>
        <UnitCellViewer3D height="300px" />
      </UnitCellProvider>
    </div>
  </div>
</div>

### 7. Cubic

**Constraints:** <MathFormula math="a = b = c, \alpha = \beta = \gamma = 90°" inline={true} />  
**Parameters:** Single length parameter  
**Degrees of freedom:** 1  
**Bravais lattices:** 3

<div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Primitive (P)</div>
    <div style={{ width: '240px', height: '240px' }}>
      <UnitCellProvider initialState={{
        params: CRYSTAL_SYSTEMS.cubic.params,
        latticeSystem: 'cubic',
        centeringType: 'P',
        displayOptions: { showGrid: false, showLatticePoints: true, showMatrixInfo: false, showImages: false, autoRotate: true }
      }}>
        <UnitCellViewer3D height="240px" />
      </UnitCellProvider>
    </div>
  </div>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Body-centered (I)</div>
    <div style={{ width: '240px', height: '240px' }}>
      <UnitCellProvider initialState={{
        params: CRYSTAL_SYSTEMS.cubic.params,
        latticeSystem: 'cubic',
        centeringType: 'I',
        displayOptions: { showGrid: false, showLatticePoints: true, showMatrixInfo: false, showImages: false, autoRotate: true }
      }}>
        <UnitCellViewer3D height="240px" />
      </UnitCellProvider>
    </div>
  </div>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Face-centered (F)</div>
    <div style={{ width: '240px', height: '240px' }}>
      <UnitCellProvider initialState={{
        params: CRYSTAL_SYSTEMS.cubic.params,
        latticeSystem: 'cubic',
        centeringType: 'F',
        displayOptions: { showGrid: false, showLatticePoints: true, showMatrixInfo: false, showImages: false, autoRotate: true }
      }}>
        <UnitCellViewer3D height="240px" />
      </UnitCellProvider>
    </div>
  </div>
</div>


## Interactive lattice

Now that you understand the fundamentals, explore how parameter constraints define different lattice systems using the full interactive tool:

<UnitCellProvider initialState={{
  params: { a: 1, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90 },
  latticeSystem: 'triclinic',
  centeringType: 'P',
  displayOptions: { showGrid: true, showLatticePoints: true, showMatrixInfo: true, showImages: false, autoRotate: false }
}}>
  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'nowrap' }}>
    <div style={{ width: '70%', flexShrink: 0 }}>
      <UnitCellViewer3D height="500px" />
    </div>
    <div style={{ width: '30%', flexShrink: 0 }}>
      <UnitCellControls />
    </div>
  </div>
  <UnitCellMatrixDisplay />
</UnitCellProvider>
