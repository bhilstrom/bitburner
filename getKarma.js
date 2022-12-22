import { pp } from './common.js'

/** @param {import(".").NS } ns */
export async function main(ns) {
    pp(ns, ns.heart.break(), true)
}