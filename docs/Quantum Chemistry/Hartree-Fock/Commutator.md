# Commutator

The commutator (or DIIS commutator) is defined as:

$$
FDS - SDF
$$

where $S$ is the overlap matrix, $D$ is the density matrix and $F$ is the Fock matrix.

Typically some error based on the commutator e.g. the $\max$ or root-mean-square deviation will be used for a test of the convergence of [SCF](SCF).