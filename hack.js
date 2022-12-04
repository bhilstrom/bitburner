import { pp } from './common.js'

/** @param {import(".").NS } ns */
export async function main(ns) {
    const target = ns.args[0]
    const threads = ns.args[1]
    const delay = ns.args[2]

    if (delay && delay > 0) {
        ns.print(`Sleeping for ${delay}`)
        await ns.sleep(delay)
    }

    ns.print(`Starting operation: hack on ${target} in ${threads} threads`)
    await ns.hack(target, { threads, stock: true })
    ns.exit()
}