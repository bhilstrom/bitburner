import { pp } from './common.js'

/** @param {import(".").NS } ns */
export async function main(ns) {
    pp(ns, "Starting findInfiltrations.js", true)

    if (ns.getHostname() !== 'home') {
        throw new Error('Must be run from home')
    }

    const uniqueLocations = ns.infiltration.getPossibleLocations()
        .map(location => location.name)

    const infiltrations = uniqueLocations
        .map(location => ns.infiltration.getInfiltration(location))
        .sort((a, b) => {
            const difficulty = a.difficulty - b.difficulty
            if (difficulty != 0) {
                return difficulty
            }

            return b.reward.tradeRep - a.reward.tradeRep
        })

    infiltrations.forEach(infiltration => {
        pp(ns, `${infiltration.location.name} [${infiltration.location.city}]: diff ${infiltration.difficulty}, reward rep ${infiltration.reward.tradeRep}`, true)
    })
}
