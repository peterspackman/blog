export { PowderPattern, type PowderPatternProps } from './PowderPattern';
export { UnitCellView, type UnitCellViewProps } from './UnitCellView';
export { ReciprocalLattice, type ReciprocalLatticeProps } from './ReciprocalLattice';

// Unified 3D viewer (replaces UnitCellView + ElectronDensity3D for combined view)
export { Viewer3D, type Viewer3DProps, type VolumeGrid, type SlicePlaneConfig } from '../Viewer3D';
export { ElectronDensity, type ElectronDensityProps } from './ElectronDensity';
export { ElectronDensity3D, type ElectronDensity3DProps } from './ElectronDensity3D';
export { DiffractionControls, type DiffractionControlsProps } from './DiffractionControls';
export { FormFactorPlot, FormFactorInfo } from './FormFactorPlot';
export { FormFactorEditor, interpolateFormFactor, interpolateFormFactorSmooth, type ElementFormFactor } from './FormFactorEditor';

export {
    type Atom,
    type CrystalStructure,
    type Complex,
    type Reflection,
    type DiffractionParams,
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
    CU_K_ALPHA,
    MO_K_ALPHA,
} from './physics';

export {
    NaCl,
    CsCl,
    Diamond,
    Benzene,
    STRUCTURES,
    STRUCTURE_LIST,
} from './structures';
