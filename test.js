import { localeHHMMSS, settings, getItem, pp } from './common.js'

/** @param {import(".").NS } ns */
export function main(ns) {

    const currentWork = ns.singularity.getCurrentWork()
    pp(ns, `Current work: ${JSON.stringify(currentWork, null, 2)}`, true)
}