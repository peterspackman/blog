/**
 * The iterations of the most recent SCF in a log. An optimisation or
 * frequency run solves one SCF per geometry, and the iteration counter
 * restarts each time.
 */
export function lastScfBlock<T extends { iter: number }>(iterations: readonly T[]): T[] {
    let start = 0;
    for (let i = 1; i < iterations.length; i++) {
        if (iterations[i].iter <= iterations[i - 1].iter) start = i;
    }
    return iterations.slice(start);
}

/** How many SCFs a log holds. */
export function countScfBlocks(iterations: readonly { iter: number }[]): number {
    if (iterations.length === 0) return 0;
    let blocks = 1;
    for (let i = 1; i < iterations.length; i++) {
        if (iterations[i].iter <= iterations[i - 1].iter) blocks++;
    }
    return blocks;
}
