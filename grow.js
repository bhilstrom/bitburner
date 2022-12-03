import { pp } from './common.js'

/** @param {import(".").NS } ns */
export async function main(ns) {
    const target = ns.args[0]
    const threads = ns.args[1]
    const delay = ns.args[2]

    if (delay && delay > 0) {
        pp(ns, `Sleeping for ${delay}`)
        await ns.sleep(delay)
    }

    pp(ns, `Starting operation: grow on ${target} in ${threads} threads`)
    await ns.grow(target, { threads, stock: true })
    ns.exit()
}