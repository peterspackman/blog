/** Small molecules to start from. Rough geometries: optimise before trusting frequencies. */
export const EXAMPLE_MOLECULES: { id: string; name: string; xyz: string }[] = [
    {
        id: 'water',
        name: 'Water',
        xyz: `3
Water
O  0.0000  0.0000  0.1173
H  0.0000  0.7572 -0.4692
H  0.0000 -0.7572 -0.4692`,
    },
    {
        id: 'formaldehyde',
        name: 'Formaldehyde',
        xyz: `4
Formaldehyde
H  1.0686 -0.1411  1.0408
C  0.5979  0.0151  0.0688
H  1.2687  0.2002 -0.7717
O -0.5960 -0.0151 -0.0686`,
    },
    {
        id: 'ammonia',
        name: 'Ammonia',
        xyz: `4
Ammonia
N  0.0000  0.0000  0.0000
H  0.0000  0.9500  0.3300
H  0.8200 -0.4800  0.3300
H -0.8200 -0.4800  0.3300`,
    },
    {
        id: 'methane',
        name: 'Methane',
        xyz: `5
Methane
C  0.0000  0.0000  0.0000
H  0.6290  0.6290  0.6290
H -0.6290 -0.6290  0.6290
H -0.6290  0.6290 -0.6290
H  0.6290 -0.6290 -0.6290`,
    },
    {
        id: 'ethylene',
        name: 'Ethylene',
        xyz: `6
Ethylene
C  0.0000  0.0000  0.6680
C  0.0000  0.0000 -0.6680
H  0.0000  0.9230  1.2320
H  0.0000 -0.9230  1.2320
H  0.0000  0.9230 -1.2320
H  0.0000 -0.9230 -1.2320`,
    },
    {
        id: 'formamide',
        name: 'Formamide',
        xyz: `6
Formamide
C  0.0000  0.0000  0.0000
O  1.2200  0.0000  0.0000
N -0.6100  1.1500  0.0000
H -0.6100 -0.9500  0.0000
H -1.6100  1.1500  0.0000
H -0.1100  2.0500  0.0000`,
    },
    {
        id: 'urea',
        name: 'Urea',
        xyz: `8
Urea
C  0.0000  0.0000  0.0000
O  0.0000  1.2200  0.0000
N  1.1500 -0.6100  0.0000
N -1.1500 -0.6100  0.0000
H  1.1500 -1.6100  0.0000
H  2.0500 -0.1100  0.0000
H -1.1500 -1.6100  0.0000
H -2.0500 -0.1100  0.0000`,
    },
];
