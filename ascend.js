import { forEachSleeve, pp } from './common.js'

const FORCE_HACK = 'forceHack'
const FORCE_NUMBER = 'forceNumber'

const HACKING_STATS = [
    'hacking',
    'hacking_exp',
    'hacking_chance',
    'hacking_speed',
    'hacking_money',
    'hacking_grow',
]

const FACTION_STATS = [
    'faction_rep',
]

/** @param {import(".").NS } ns */
function getAugs(ns) {

    const currentAugs = ns.singularity.getOwnedAugmentations(true)

    const augs = {}
    ns.getPlayer().factions.forEach(faction => {
        ns.singularity.getAugmentationsFromFaction(faction).forEach(aug => {

            // Don't include augs we already have
            if (currentAugs.includes(aug)) {
                return
            }

            const anyPrereqsMissing = ns.singularity.getAugmentationPrereq(aug).some(prereq => {
                return !currentAugs.includes(prereq)
            })

            // Don't include stats on augs we can't get yet
            if (anyPrereqsMissing) {
                return
            }

            if (!(aug in augs)) {
                augs[aug] = {
                    name: aug,
                    price: ns.singularity.getAugmentationPrice(aug),
                    repReq: ns.singularity.getAugmentationRepReq(aug),
                    stats: ns.singularity.getAugmentationStats(aug),
                    factions: []
                }
            }

            if (ns.singularity.getFactionRep(faction) > augs[aug].repReq) {
                augs[aug].factions.push(faction)
            }
        })
    })

    const augsArray = Object.values(augs)
    return augsArray.filter(aug => aug.factions.length > 0)
}

function getMostExpensiveAugs(augs) {
    return augs.sort((a, b) => {
        return b.price - a.price
    })
}

/** @param {import(".").NS } ns */
function filterAugs(ns, augs, statsToFilter) {
    const availableMoney = ns.getPlayer().money
    return augs.filter(aug => {
        return statsToFilter.some(stat => aug.stats[stat] > 1)
    }).filter(aug => {
        return aug.price < availableMoney
    })
}

/** @param {import(".").NS } ns */
function getAugToPurchase(ns, desiredStats) {
    let augs = getAugs(ns)
    let desiredAugs = filterAugs(ns, augs, desiredStats)
    let augsByCost = getMostExpensiveAugs(desiredAugs)
    let augToPurchase = augsByCost[0]
    return augToPurchase
}

/** @param {import(".").NS } ns */
async function purchaseStatAugs(ns, statsToPurchase) {
    let augsPurchasedCount = 0
    let augToPurchase = getAugToPurchase(ns, statsToPurchase)
    while (augToPurchase) {
        const faction = augToPurchase.factions[0]
        const name = augToPurchase.name
        pp(ns, `Purchasing ${name} from ${faction}`, true)
        if (!ns.singularity.purchaseAugmentation(faction, name)) {
            throw new Error(`Failed to purchase ${name}`)
        }
        augsPurchasedCount += 1
        await ns.sleep(100)
        augToPurchase = getAugToPurchase(ns, statsToPurchase)
    }
    return augsPurchasedCount
}

/** @param {import(".").NS } ns */
function purchaseNeuroFluxGovernors(ns) {
    let gangFaction = undefined
    if (ns.gang.inGang()) {
        gangFaction = ns.gang.getGangInformation().faction
    }

    let maxRep = Number.MIN_SAFE_INTEGER
    let maxRepFaction = undefined
    ns.getPlayer().factions.forEach(faction => {

        // Can't purchase NeuroFlux Governor from the gang faction
        if (faction === gangFaction) {
            return
        }

        const factionRep = ns.singularity.getFactionRep(faction)
        if (factionRep > maxRep) {
            maxRep = factionRep
            maxRepFaction = faction
        }
    })

    // Purchase all available NeuroFlux Governor
    while (ns.singularity.purchaseAugmentation(maxRepFaction, 'NeuroFlux Governor')) { }
}

/** @param {import(".").NS } ns */
async function purchaseSleeveAugs(ns) {
    forEachSleeve(ns, (sleeveNum) => {
        const shock = ns.sleeve.getSleeve(sleeveNum).shock
        if (shock > 0) {
            pp(ns, `Sleeve ${sleeveNum} has ${shock} shock, aug purchasing not available.`)
            return
        }

        let augCount = 0
        ns.sleeve.getSleevePurchasableAugs(sleeveNum).forEach(augPair => {
            if (ns.sleeve.purchaseSleeveAug(sleeveNum, augPair.name)) {
                augCount += 1
            }
        })

        if (augCount > 0) {
            pp(ns, `Purchased ${augCount} augs for sleeve ${sleeveNum}`, true)
        }
    })
}

/** @param {import(".").NS } ns */
async function upgradeHomeMachine(ns) {
    let homeServer = ns.getServer('home')

    // Only upgrade to 256 TB
    while (homeServer.maxRam < Math.pow(2, 18) && ns.singularity.upgradeHomeRam()) {
        pp(ns, `Home machine RAM upgraded!`, true)
        await ns.sleep(100)
        homeServer = ns.getServer('home')
    }

    // Only upgrade to 5 cores
    while (homeServer.cpuCores < 5 && ns.singularity.upgradeHomeCores()) {
        pp(ns, `Home machine cores upgraded!`, true)
        await ns.sleep(100)
        homeServer = ns.getServer('home')
    }
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    const forceHack = ns.args.includes(FORCE_HACK)
    const forceNumber = ns.args.includes(FORCE_NUMBER)

    /*
    - Purchase any +hack augs
    - Purchase any +faction rep augs
    - Purchase as many NeuroFlux as we can
        - Donate to faction to increase rep if necessary
    */
    await upgradeHomeMachine(ns)

    const hackingAugCount = await purchaseStatAugs(ns, HACKING_STATS)
    if (hackingAugCount < 4 && !forceHack) {
        pp(ns, `Only able to purchase ${hackingAugCount} hacking augs, stopping script. Run with '${FORCE_HACK}' to bypass check.`, true)
        return
    }

    await purchaseStatAugs(ns, FACTION_STATS)
    
    purchaseNeuroFluxGovernors(ns)

    // Number of augs we're purchasing is 'owned(true)' - 'owned(false)'
    const numberOfAugsPending = ns.singularity.getOwnedAugmentations(true).length - ns.singularity.getOwnedAugmentations(false).length
    if (numberOfAugsPending < 10 && !forceNumber) {
        pp(ns, `Only ${numberOfAugsPending} augs are pending installation, stopping script. Run with '${FORCE_NUMBER} to bypass check.`, true)
        return
    }

    await purchaseSleeveAugs(ns)
}

export function autocomplete(data, args) {
    return [
        FORCE_HACK,
        FORCE_NUMBER,
    ]
}
