/** All money in ALONG is whole Naira. */
export const roundNaira = (n: number, step = 1): number => Math.round(n / step) * step;
export const toNaira = (n: number): number => Math.round(n);
