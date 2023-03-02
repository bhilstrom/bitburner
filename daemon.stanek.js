import { settings, runAndWaitForThreads, pp } from "./common"

/** @param {import(".").NS } ns */
export async function main(ns) {

    const s = ns.stanek

    const scriptRam = ns.getScriptRam('stanek.js', 'home')

    while (true) {

        // Fragments with id > 100 are Booster fragments.
        // See https://github.com/bitburner-official/bitburner-src/blob/stable/src/CotMG/Fragment.ts
        const fragments = s.activeFragments()
            .filter(fragment => fragment.id < 100)
            .sort((a, b) => a.numCharge - b.numCharge)

        // pp(ns, `Fragments: ${JSON.stringify(fragments, null, 2)}`)

        if (fragments.length) {
            const server = ns.getServer('home')
            const ramToUse = server.maxRam - server.ramUsed - settings().homeRamReserved
    
            const threads = Math.floor(ramToUse / scriptRam)

            const fragment = fragments[0]

            pp(ns, `Growing fragment ${fragment.id} at (${fragment.x}, ${fragment.y})`)
            
            await runAndWaitForThreads(ns, 'stanek.js', threads, fragment.x, fragment.y)
        } else {
            pp(ns, `No active fragments.`)
        }

        await ns.sleep(100)
    }
}