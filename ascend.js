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
function getAugData(ns, augName) {
    return {
        name: augName,
        price: ns.singularity.getAugmentationPrice(augName),
        repReq: ns.singularity.getAugmentationRepReq(augName),
        stats: ns.singularity.getAugmentationStats(augName),
        factions: []
    }
}

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
                augs[aug] = getAugData(ns, aug)
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
function filterAugs(ns, augs, statsToFilter, removeUnaffordable = true) {
    const availableMoney = ns.getPlayer().money
    let filteredAugs = augs.filter(aug => {
        return statsToFilter.some(stat => aug.stats[stat] > 1)
    })

    if (removeUnaffordable) {
        filteredAugs = filteredAugs.filter(aug => {
            return aug.price < availableMoney
        })  
    }

    return filteredAugs
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
function getPurchasedAugs(ns) {
    // Number of augs we're purchasing is 'owned(true)' - 'owned(false)'
    const augsAlreadyInstalled = ns.singularity.getOwnedAugmentations(false)
    const allAugs = ns.singularity.getOwnedAugmentations(true)
    
    // In possibly the weirdest way you could do this, NeuroFlux Governor is not listed with its level.
    // Instead, it is listed multiple times -- as in, in looks like it repeats.
    // This means that when we filter out previously-installed augs, ALL the NeuroFlux Governor are stripped out.
    let newAugs = allAugs.filter(aug => !augsAlreadyInstalled.includes(aug))

    const governorAug = 'NeuroFlux Governor'
    if (allAugs.includes(governorAug)) {
       let governorAugs = allAugs.filter(aug => aug == governorAug)

       // The list of already-installed augs includes ONE entry for NeuroFlux Governor, regardless of level.
       // Therefore, we should remove ONE item from governorAugs if we already have one installed.
       if (augsAlreadyInstalled.includes(governorAug)) {
        governorAugs.pop()
       }

       newAugs = [...newAugs, ...governorAugs]
    }

    return newAugs
}

/** @param {import(".").NS } ns */
export async function ascend(ns, ...args) {
    const forceHack = args.includes(FORCE_HACK)
    const forceNumber = args.includes(FORCE_NUMBER)

    /*
    - Purchase any +hack augs
    - Purchase any +faction rep augs
    - Purchase as many NeuroFlux as we can
        - Donate to faction to increase rep if necessary
    */
    await upgradeHomeMachine(ns)

    await purchaseStatAugs(ns, HACKING_STATS)

    const purchasedAugsTemp = getPurchasedAugs(ns)
    pp(ns, `purchasedAugs: ${purchasedAugsTemp}`)

    let purchasedAugs = purchasedAugsTemp
        .map(augName => getAugData(ns, augName))

    pp(ns, `purchasedAugs: ${JSON.stringify(purchasedAugs, null, 2)}`)

    const purchasedHackAugs = filterAugs(ns, purchasedAugs, HACKING_STATS, false)
    pp(ns, `purchasedHackAugs: ${JSON.stringify(purchasedHackAugs, null, 2)}`)
    if (purchasedHackAugs.length < 4 && !forceHack) {
        pp(ns, `Only able to purchase ${purchasedHackAugs.length} hacking augs, stopping script. Run with '${FORCE_HACK}' to bypass check.`, true)
        return false
    }

    await purchaseStatAugs(ns, FACTION_STATS)

    purchaseNeuroFluxGovernors(ns)

    const numberOfAugsPending = getPurchasedAugs(ns).length
    if (numberOfAugsPending < 10 && !forceNumber) {
        pp(ns, `Only ${numberOfAugsPending} augs are pending installation, stopping script. Run with '${FORCE_NUMBER} to bypass check.`, true)
        return false
    }

    await purchaseSleeveAugs(ns)
    return true
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    await ascend(ns, ...ns.args)
}

export function autocomplete(data, args) {
    return [
        FORCE_HACK,
        FORCE_NUMBER,
    ]
}
