import { getFactions, pp } from "./common"

/** @param {import(".").NS } ns */
export async function main(ns) {
    [
        "sleep",
    ].forEach(logName => ns.disableLog(logName))

    const faction = ns.args[0]
    if (!getFactions().includes(faction)) {
        throw new Error(`${faction} is not a recognized faction. Try again.`)
    }

    pp(ns, `Waiting until we're a member of ${faction}`)
    while (!ns.getPlayer().factions.includes(faction)) {
        await ns.sleep(10000)
    }
    pp(ns, `We're a member of ${faction}!`)

    const favorToDonate = ns.getFavorToDonate()
    const currentFavor = ns.singularity.getFactionFavor(faction)
    let favorGain = ns.singularity.getFactionFavorGain(faction)
    while ((currentFavor + favorGain) < favorToDonate) {
        pp(ns, `Need ${favorToDonate} favor to donate, currently have ${currentFavor}, will gain ${favorGain}`)
        await ns.sleep(10 * 1000)
        favorGain = ns.singularity.getFactionFavorGain(faction)
    }
    pp(ns, `We have enough rep to donate to faction. Ascending!`, true)
    ns.spawn('autoAscend.js', 1)
}

export function autocomplete(data, args) {
    return getFactions()
}