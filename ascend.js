import { localeHHMMSS, pp } from './common.js'

const HACKING_AUG_STATS = [
    'hacking',
    'hacking_exp',
    'hacking_chance',
    'hacking_speed',
    'hacking_money',
    'hacking_grow',
]

/** @param {import(".").NS } ns */
function getAugs(ns) {

    const augs = {}

    ns.getPlayer().factions.forEach(faction => {
        ns.singularity.getAugmentationsFromFaction(faction).forEach(aug => {
            if (!(aug in augs)) {
                augs[aug] = {
                    name: aug,
                    price: ns.singularity.getAugmentationPrice(aug),
                    repReq: ns.singularity.getAugmentationRepReq(aug),
                    stats: ns.singularity.getAugmentationStats(aug),
                    factions: []
                }
            }

            augs[aug].factions.push(faction)
        })
    })

    return augs
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    /*
    - Purchase any +hack augs
    - Purchase any +faction rep augs
    - Purchase as many NeuroFlux as we can
        - Donate to faction to increase rep if necessary
    */

    let augs = getAugs(ns)

    const hackingAugs = Object.fromEntries(Object.entries(augs).filter(([k, v]) => {
        return HACKING_AUG_STATS.some(stat => v.stats[stat] > 1)
    }))

    pp(ns, `Hacking augs: ${JSON.stringify(hackingAugs, null, 2)}`, true)
}