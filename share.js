import { pp } from './common.js'

/** @param {import(".").NS } ns */
export async function main(ns) {
    pp(ns, 'Sharing RAM with factions', true)

    while (true) {
        await ns.share()
        await ns.sleep(5000)
    }
}
