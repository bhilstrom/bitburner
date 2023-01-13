import { pp } from './common.js'

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
                !currentAugs.includes(prereq)
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
    let augToPurchase = getAugToPurchase(ns, statsToPurchase)
    while (augToPurchase) {
        const faction = augToPurchase.factions[0]
        const name = augToPurchase.name
        pp(ns, `Purchasing ${name} from ${faction}`, true)
        if (!ns.singularity.purchaseAugmentation(faction, name)) {
            throw new Error(`Failed to purchase ${name}`)
        }
        await ns.sleep(100)
        augToPurchase = getAugToPurchase(ns, statsToPurchase)
    }
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    /*
    - Purchase any +hack augs
    - Purchase any +faction rep augs
    - Purchase as many NeuroFlux as we can
        - Donate to faction to increase rep if necessary
    */
    await purchaseStatAugs(ns, HACKING_STATS)
    await purchaseStatAugs(ns, FACTION_STATS)

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
    while (ns.singularity.purchaseAugmentation(maxRepFaction, 'NeuroFlux Governor')) {}
}