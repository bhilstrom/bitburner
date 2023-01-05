import { localeHHMMSS, settings, getItem, pp } from './common.js'

/** @param {import(".").NS } ns */
export function main(ns) {

    pp(ns, JSON.stringify(ns.singularity.getCurrentWork(), null, 2), true)
    
}