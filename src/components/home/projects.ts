export interface Project {
    name: string;
    /** Project site; falls back to GitHub. */
    href?: string;
    docs?: string;
    github?: string;
    /** In-browser version on this site. */
    tryHref?: string;
    languages: string;
    /** One line for the home page card. */
    blurb: string;
    /** A few sentences for the software page. */
    description: string;
    image?: string;
    status?: string;
}

/** The main projects, in the order they appear on the home and software pages. */
export const FEATURED: Project[] = [
    {
        name: 'OCC',
        href: 'https://getocc.xyz',
        docs: 'https://peterspackman.github.io/occ',
        github: 'https://github.com/peterspackman/occ',
        tryHref: '/utilities/wavefunction-calculator',
        languages: 'C++ · Python · JS',
        blurb: "Quantum chemistry and crystallography program and library. It's also what runs the wavefunction calculator here.",
        description:
            'A quantum chemistry and crystallography program and library, written in C++ with Python and JavaScript bindings. Still under active development, so expect things to move around.',
        image: '/img/prs.png',
    },
    {
        name: 'CrystalExplorer',
        href: 'https://crystalexplorer.net',
        github: 'https://github.com/peterspackman/crystalexplorer',
        languages: 'C++ · Qt',
        blurb: 'Crystal structure analysis with Hirshfeld surfaces, interaction energies and more. Now open source.',
        description:
            "Crystal structure analysis with Hirshfeld surfaces, intermolecular interaction energies, energy frameworks and more. It's open source now (LGPL), and uses OCC under the hood.",
        image: '/img/CrystalExplorer512x512.png',
    },
    {
        name: 'chmpy',
        docs: 'https://peterspackman.github.io/chmpy/',
        github: 'https://github.com/peterspackman/chmpy',
        languages: 'Python',
        blurb: 'Computational chemistry in python: molecules, crystals, Hirshfeld surfaces and shape descriptors.',
        description:
            'A library for computational chemistry in python. Handles molecules, crystals, Hirshfeld and promolecule density isosurfaces, spherical harmonic shape descriptors and more.',
        image: '/img/chmpy_logo.png',
    },
    {
        name: 'mlip.cpp',
        github: 'https://github.com/peterspackman/mlip.cpp',
        languages: 'C++ · Python',
        blurb: 'MLIP inference using ggml. Runs PET/uPET models for energies, forces and stresses.',
        description:
            'MLIP inference using ggml. Currently runs PET/uPET models (energies, forces, stresses), with Python bindings. Early days.',
        status: 'pre-alpha',
    },
];

/** Smaller projects for the software page. */
export const MORE: Project[] = [
    {
        name: 'kmcpp',
        github: 'https://github.com/peterspackman/kmcpp',
        languages: 'C++',
        blurb: 'Kinetic Monte Carlo for crystal growth simulations.',
        description: 'Kinetic Monte Carlo for crystal growth simulations.',
    },
    {
        name: 'msevb-lammps',
        github: 'https://github.com/peterspackman/msevb-lammps',
        languages: 'C++',
        blurb: 'MS-EVB in LAMMPS.',
        description: 'Multistate empirical valence bond (MS-EVB) implementation in LAMMPS.',
    },
    {
        name: 'steinhardt_f90',
        github: 'https://github.com/peterspackman/steinhardt_f90',
        languages: 'Fortran',
        blurb: 'Steinhardt order parameters in Fortran.',
        description: 'Legendre polynomials, spherical harmonics, Wigner 3j symbols and Steinhardt order parameters in Fortran.',
    },
    {
        name: 'sbf',
        github: 'https://github.com/peterspackman/sbf',
        languages: 'Fortran · C++',
        blurb: 'Simple binary format.',
        description: 'Simple binary format: a small dependency for quickly moving data between C, C++ and Fortran.',
    },
];

/** Packages behind the in-browser tools on this site. */
export const WEB_PACKAGES = [
    { name: '@peterspackman/occjs', href: 'https://www.npmjs.com/package/@peterspackman/occjs', what: 'OCC in WebAssembly', tool: 'Wavefunction calculator', toolHref: '/utilities/wavefunction-calculator' },
    { name: 'lmpjs', href: 'https://github.com/peterspackman/lmpjs', what: 'LAMMPS in WebAssembly', tool: 'LAMMPS in the browser', toolHref: '/utilities/lammps-interface' },
    { name: 'selfies-js', href: 'https://github.com/peterspackman/selfies-js', what: 'A TypeScript port of SELFIES', tool: 'Infinite molecules', toolHref: '/utilities/infinite-molecules' },
];
