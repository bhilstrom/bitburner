import { pp } from './common.js'

function log102(n) {
    return Math.log(n) / Math.log(1.02)
}

/** @param {import(".").NS } ns */
export function main(ns) {


    /*
    * r = reputation
    * favor = 1 + floor(log[1.02]((r + 25000) / 25500)
    * 
    * Converts to
    * 
    * r = (1.02^[favor-1] x 25500) - 2500
    */
    
    const favorWeHave = ns.args[0]
    const favorNeeded = 150 - favorWeHave
    const repNeeded = (Math.pow(1.02, favorNeeded - 1) * 25500) - 25000
    pp(ns, `Starting at ${favorWeHave} favor, we need ${repNeeded} reputation to reach 150.`, true)
}