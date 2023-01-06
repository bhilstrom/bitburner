import { pp } from './common.js'

/** @param {import(".").NS } ns */
export async function main(ns) {

    [
        "sleep",
    ].forEach(logName => ns.disableLog(logName))

    let home = ns.getServer('home')
    while (home.maxRam < 1024) {

        pp(ns, `Max home ram is ${home.maxRam}, trying to upgrade...`)
        ns.singularity.upgradeHomeRam()

        await ns.sleep(60 * 1000)
        home = ns.getServer('home')
    }
}