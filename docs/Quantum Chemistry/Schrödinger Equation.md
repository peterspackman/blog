# The Schrödinger Equation

Typically referring to the *time-independent* Schrodinger Equation:

$$
\hat{H}\Psi = E \Psi
$$

which relates the total energy of the system, $E$, its wavefunction $\Psi$, a function of particle coordinates (spatial or momentum, spin), and
the Hamiltonian operator $\hat{H}$.

The Hamiltonian for a typical chemical system will be something like:

$$
\hat{H} = \hat{T}_e + \hat{V}_{ee} + \hat{V}_{en} + \hat{T}_n + \hat{V}_{nn}
$$

where $\hat{T}_e$ and $\hat{T}_n$ are kinetic energy terms for the electrons $e$ and nuclei $n$ and
$\hat{V}_{ee}$, $\hat{V}_{en}$ and $\hat{V}_{nn}$ are potential energy terms for electron-electron, electron-nuclear and nuclear-nuclear interactions.


$$
\hat{T}_e = - \frac{\nabla^2 i}{2}
$$
$$
\hat{T}_n = - \frac{\nabla^2 A}{2 M_A}
$$
$$
\hat{V}_{ee} = \sum_{i<j} \frac{1}{r_{ij}}
$$
$$
\hat{V}_{en} = -\sum_{A,i} \frac{Z_A}{r_{Ai}}
$$
$$
\hat{V}_{nn} = \sum_{A<B} \frac{Z_A Z_B}{r_{AB}}
$$

where:
- $i$ and $j$ indicate electrons,
- $A$ and $B$ indicate nuclei with nuclear charge $Z$ and mass $M$,
- $\nabla$ is the Laplacian