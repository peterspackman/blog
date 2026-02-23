declare module 'fft.js' {
    class FFT {
        constructor(size: number);
        size: number;
        createComplexArray(): number[];
        toComplexArray(input: ArrayLike<number>, storage?: number[]): number[];
        fromComplexArray(complex: number[], storage?: number[]): number[];
        completeSpectrum(spectrum: number[]): void;
        transform(out: number[], data: number[]): void;
        realTransform(out: number[], data: ArrayLike<number>): void;
        inverseTransform(out: number[], data: number[]): void;
    }
    export = FFT;
}
