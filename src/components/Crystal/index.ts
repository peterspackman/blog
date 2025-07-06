export { CrystalProvider, useCrystal } from './CrystalContext';
export { CrystalStructureProvider, useCrystalStructures } from './CrystalStructureProvider';
export { default as CrystalViewer3D } from './CrystalViewer3D';
export { default as CrystalControls } from './CrystalControls';
export { default as CrystalControlsWithStructures } from './CrystalControlsWithStructures';
export { default as CrystalCIFEditor } from './CrystalPDBEditor';
export { default as CrystalGUIEditor } from './CrystalGUIEditor';
export { default as CrystalInfo } from './CrystalInfo';
export { CRYSTAL_STRUCTURES, EDUCATIONAL_STRUCTURES } from './predefinedStructures';
export * from './types';

// Backwards compatibility wrapper
export { default as CrystalWorkshopViewer } from './CrystalWorkshopViewer';