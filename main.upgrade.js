import { pp } from './common.js'

/** @param {import(".").NS } ns */
export async function main(ns) {

    [
        "sleep",
    ].forEach(logName => ns.disableLog(logName))

    let home = ns.getServer('home')
    // 2^10 is 1024 GB (1 TB)
    // 2^15 is 32 TB
    const desiredRam = Math.pow(2, 15)
    while (home.maxRam < desiredRam) {

        pp(ns, `Max home ram is ${home.maxRam}, trying to upgrade until ${desiredRam}...`)
        ns.singularity.upgradeHomeRam()

        await ns.sleep(60 * 1000)
        home = ns.getServer('home')
    }

    pp(ns, `We have ${home.maxRam} RAM available on home server, that's enough for now. Exiting.`, true)
}