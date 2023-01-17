import { pp } from "./common"

/** @param {import(".").NS } ns */
export async function main(ns) {

    if (ns.gang.inGang()) {
        pp(ns, `In gang, starting gang scripts`, true)
        ns.exec('gang.start.js', 'home')
    } else {
        pp(ns, `Not in gang yet, no need to start gang scripts.`, true)
    }

    ns.exec('main.start.js', 'home')
}