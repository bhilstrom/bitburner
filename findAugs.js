import { getFactions, pp } from './common.js'

function getFilteredAugs(augs, filter) {
    const newAugs = {}
    Object.keys(augs).forEach(aug => {
        if (filter(aug)) {
            newAugs[aug] = augs[aug]
        }
    })
    return newAugs
}

/** @param {import(".").NS } ns */
function isHackAug(ns, augName) {
    // pp(ns, `Getting aug stats for ${augName}`, true)
    const stats = ns.singularity.getAugmentationStats(augName)

    const hackStats = [
        'hacking',
        'hacking_exp',
        'hacking_chance',
        'hacking_speed',
        'hacking_money',
        'hacking_grow',
    ]

    return hackStats.some(hackStatName => stats[hackStatName] > 1)
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    const showHackAugsOnly = ns.args[0] == 'hackOnly'

    // Make a map of aug -> [factions where aug is available]
    let augs = {}
    getFactions().forEach(faction => {
        const factionAugs = ns.singularity.getAugmentationsFromFaction(faction)
        factionAugs.forEach(factionAug => {
            if (showHackAugsOnly && !isHackAug(ns, factionAug)) {
                return
            }

            if (augs[factionAug] === undefined) {
                augs[factionAug] = {
                    name: factionAug,
                    factions: []
                }
            }

            augs[factionAug].factions.push(faction)
        })
    })

    const gangFaction = ns.gang.getGangInformation().faction
    augs = getFilteredAugs(augs, (augName) => {
        
        // Remove augs we already own
        if (ns.singularity.getOwnedAugmentations(true).includes(augName)) {
            return false
        }

        // Remove augs available from our gang
        if (augs[augName].factions.includes(gangFaction)) {
            return false
        }

        return true
    })

    pp(ns, `Fantastic Augs and Where to Find Them:`, true)
    Object.keys(augs).forEach(augName => {
        const aug = augs[augName]
        ns.tprint(`${aug.name}: ${aug.factions}`)
        // ns.tprint(`     `)
    })

}
