import { localeHHMMSS, pp } from './common.js'

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

    return Object.fromEntries(object.entries(augs).filter(([k, v]) => {
        return v.factions.length > 0
    }))
}

function getMostExpensiveAugs(augs) {
    return Object.keys(augs).sort((a, b) => {
        return b.price - a.price
    })
}

function filterAugs(augs, statsToFilter) {
    return Object.fromEntries(Object.entries(augs).filter(([k, v]) => {
        return statsToFilter.some(stat => v.stats[stat] > 1)
    }))
}

/** @param {import(".").NS } ns */
function getAugToPurchase(ns, desiredStats) {
    let augs = getAugs(ns)
    let hackingAugs = filterAugs(augs, desiredStats)
    let augsByCost = getMostExpensiveAugs(hackingAugs)

    const availableMoney = ns.getPlayer().money
    let augToPurchase = augsByCost.find(aug => aug.price < availableMoney)

    return augToPurchase
}

/** @param {import(".").NS } ns */
async function purchaseStatAugs(ns, statsToPurchase) {
    let augToPurchase = getAugToPurchase(ns, statsToPurchase)
    while (augToPurchase) {
        const faction = augToPurchase.factions[0]
        const name = augToPurchase.name
        pp(ns, `Purchasing ${name} from ${faction}`, true)
        ns.singularity.purchaseAugmentation(faction, name)
        await ns.sleep(100)
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
}