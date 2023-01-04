import { localeHHMMSS, settings, getItem, pp } from './common.js'

/** @param {import(".").NS } ns */
export function main(ns) {

    pp(ns, ns.gang.getGangInformation().territory, true)
    
}