export { PowderPattern, type PowderPatternProps } from './PowderPattern';
export { ReciprocalLattice, type ReciprocalLatticeProps } from './ReciprocalLattice';

// Unified 3D viewer (replaces UnitCellView + ElectronDensity3D for combined view)
export { Viewer3D, type Viewer3DProps, type VolumeGrid, type SlicePlaneConfig } from '../Viewer3D';
export { ElectronDensity, type ElectronDensityProps } from './ElectronDensity';
export { DiffractionControls, type DiffractionControlsProps } from './DiffractionControls';
export { FormFactorEditor, interpolateFormFactor, interpolateFormFactorSmooth, type ElementFormFactor } from './FormFactorEditor';

export {
    type Atom,
    type CrystalStructure,
    type Complex,
    type Reflection,
    type DiffractionParams,
    type ControlPoint,
    calculateDSpacing,
    calculateTwoTheta,
    calculateStructureFactor,
    calculatePowderPattern,
    calculateElectronDensity,
    calculateElectronDensitySlice,
    atomicFormFactor,
    isSystematicallyAbsent,
    isAllowedReflection,
    calculateMultiplicity,
    formatHKL,
    getElementColor,
    getAtomicRadius,
    FORM_FACTOR_COEFFS,
    CU_K_ALPHA,
    MO_K_ALPHA,
} from './physics';

export {
    NaCl,
    Diamond,
    Benzene,
    STRUCTURES,
    STRUCTURE_LIST,
} from './structures';
