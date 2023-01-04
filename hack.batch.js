import { localeHHMMSS, pp } from './common.js'

/** @param {import(".").NS } ns */
export async function main(ns) {
    const target = ns.args[0]
    const timeToLand = ns.args[1]

    let runtime = ns.getHackTime(target)
    let currentTime = performance.now()

    const delay = timeToLand - currentTime - runtime
    pp(ns, `Sleeping for ${delay}. Landing time: ${localeHHMMSS(timeToLand)}`)
    await ns.sleep(delay)

    pp(ns, `Starting operation: hack on ${target}`)
    await ns.hack(target)
}