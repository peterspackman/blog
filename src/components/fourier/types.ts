export type PatternType =
    | 'rectangle'
    | 'doubleSlit'
    | 'circle'
    | 'grating'
    | 'gaussian'
    | 'pointSources'
    | 'rhombus'
    | 'packedShapes';

export type PackShape = 'circle' | 'square' | 'rhombus';
export type PackPacking = 'square' | 'hex';

export type InputMode = 'pattern' | 'draw' | 'upload';

export type DisplayMode = 'magnitude' | 'phase' | 'real' | 'imaginary';

export type ColormapType = 'viridis' | 'inferno' | 'magma';

export interface PatternParams {
    // Rectangle
    rectWidth: number;   // 0-1 fraction of image
    rectHeight: number;

    // Double slit
    slitWidth: number;
    slitSeparation: number;

    // Circle
    circleRadius: number;

    // Grating
    gratingFrequency: number; // cycles across image
    gratingAngle: number;     // degrees

    // Gaussian
    sigmaX: number;
    sigmaY: number;

    // Point sources
    pointCount: number;
    pointSpacing: number;

    // Rhombus
    rhombusWidth: number;   // 0-1 fraction of image (horizontal diagonal)
    rhombusHeight: number;  // 0-1 fraction of image (vertical diagonal)

    // Packed shapes
    packShape: PackShape;
    packPacking: PackPacking;
    packElementSize: number;   // 0-1 fraction of image
    packSpacing: number;       // 0-1 fraction of image
    packEnvelopeRadius: number; // 0-1 fraction of image
}

export interface FFTResult {
    magnitude: Float32Array;
    phase: Float32Array;
    real: Float32Array;
    imaginary: Float32Array;
}

export interface DrawSettings {
    wallpaperGroup: string;
    tiles: number;
}

export const DEFAULT_DRAW_SETTINGS: DrawSettings = {
    wallpaperGroup: 'p1',
    tiles: 4,
};

export const DEFAULT_PARAMS: PatternParams = {
    rectWidth: 0.15,
    rectHeight: 0.3,
    slitWidth: 0.03,
    slitSeparation: 0.15,
    circleRadius: 0.12,
    gratingFrequency: 12,
    gratingAngle: 0,
    sigmaX: 0.08,
    sigmaY: 0.08,
    pointCount: 3,
    pointSpacing: 0.12,
    rhombusWidth: 0.25,
    rhombusHeight: 0.35,
    packShape: 'circle',
    packPacking: 'hex',
    packElementSize: 0.03,
    packSpacing: 0.08,
    packEnvelopeRadius: 0.4,
};
