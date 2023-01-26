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

function getHackStats() {
    return [
        'hacking',
        'hacking_exp',
        'hacking_chance',
        'hacking_speed',
        'hacking_money',
        'hacking_grow',
    ]
}

/** @param {import(".").NS } ns */
function isHackAug(ns, augName) {
    // pp(ns, `Getting aug stats for ${augName}`, true)
    const stats = ns.singularity.getAugmentationStats(augName)

    return getHackStats().some(hackStatName => stats[hackStatName] > 1)
}

/** @param {import(".").NS } ns */
function matchesDesiredAugType(ns, desired, augName) {

    if (desired === 'all') {
        return true
    }

    let desiredStats
    if (desired === 'hack') {
        desiredStats = getHackStats()
    } else if (desired === 'factionRep') {
        desiredStats = ['factionRep']
    }

    const augStats = ns.singularity.getAugmentationStats(augName)

    return desiredStats.some(statName => augStats[statName] > 1)
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    const showHackAugsOnly = ns.args[0] == 'hackOnly'


    const desiredOptions = [
        'all',
        'hack',
        'factionRep',
    ]
    let desired = "all"
    if (ns.args.length > 0 && desiredOptions.includes(ns.args[0])) {
        desired = ns.args[0]
    }

    pp(ns, `Desired: ${desired}`, true)

    // Make a map of aug -> [factions where aug is available]
    let augs = {}
    getFactions().forEach(faction => {
        const factionAugs = ns.singularity.getAugmentationsFromFaction(faction)
        factionAugs.forEach(factionAug => {

            if (desired !== 'all' && !matchesDesiredAugType(ns, desired, factionAug)) {
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

    // Remove augs we already own
    augs = getFilteredAugs(augs, (augName) => {
        return !ns.singularity.getOwnedAugmentations(true).includes(augName)
    })

    // Remove augs available from our gang
    if (ns.gang.inGang()) {
        const gangFaction = ns.gang.getGangInformation().faction
        augs = getFilteredAugs(augs, (augName) => {
            return !augs[augName].factions.includes(gangFaction)
        })
    }

    pp(ns, `Fantastic Augs and Where to Find Them:`, true)
    Object.keys(augs).forEach(augName => {
        const aug = augs[augName]
        ns.tprint(`${aug.name}: ${aug.factions}`)
        // ns.tprint(`     `)
    })

}
