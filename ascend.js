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

    return Object.fromEntries(Object.entries(augs).filter(([k, v]) => v.factions.length > 0))
}

function getMostExpensiveAugs(augs) {
    return Object.entries(augs).sort((a, b) => {
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
    let desiredAugs = filterAugs(augs, desiredStats)
    let augNamesByCost = getMostExpensiveAugs(desiredAugs)

    pp(ns, `Aug names by cost: ${augNamesByCost}`, true)

    const availableMoney = ns.getPlayer().money
    pp(ns, `Available money: ${availableMoney}`, true)

    for(let i = 0; i < augNamesByCost.length; i++) {
        const aug = desiredAugs[augNamesByCost[i]]
        pp(ns, `${aug.name}: ${aug.price}`, true)
    }

    // let augToPurchase = augsByCost.find(aug => aug.price < availableMoney)
    let augToPurchase = desiredAugs[augNamesByCost[0]]

    pp(ns, `Aug to purchase: ${augToPurchase}`, true)
    // return augToPurchase
    return undefined
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
}