import { pp } from './common.js'

const STAT_THRESHOLD = 140

function anySleeveBelowThreshold(ns) {

    const homicideStats = [
        'strength',
        'defense',
        'dexterity',
        'agility'
    ]

    let anyBelowThreshold = false
    forEachSleeve(ns, (sleeveNum) => {
        const sleeveStats = ns.sleeve.getSleeveStats(sleeveNum)
        if (homicideStats.some(stat => sleeveStats[stat] < STAT_THRESHOLD)) {
            anyBelowThreshold = true
        }
    })

    return anyBelowThreshold
}

function forEachSleeve(ns, func) {
    const numSleeves = ns.sleeve.getNumSleeves()
    for (let sleeveNum = 0; sleeveNum < numSleeves; sleeveNum++) {
        func(sleeveNum)
    }
}

/** @param {import(".").NS } ns */
async function mugUntilThreshold(ns) {

    if (!anySleeveBelowThreshold(ns)) {
        pp(ns, `All sleeve stats above ${STAT_THRESHOLD}`, true)
        return
    }

    pp(ns, `At least one sleeve with stats below ${STAT_THRESHOLD}, setting all to Mug`, true)
    forEachSleeve(ns, (sleeveNum) => {
        ns.sleeve.setToCommitCrime(sleeveNum, 'Mug')
    })

    pp(ns, `Waiting for all stats to be ${STAT_THRESHOLD} or above`, true)
    while (anySleeveBelowThreshold(ns)) {
        await ns.sleep(30 * 1000)
    }
    pp(ns, `All stats ${STAT_THRESHOLD} or above!`, true)
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    ns.disableLog('sleep')

    await mugUntilThreshold(ns)

    pp(ns, 'Starting homicides', true)
    forEachSleeve(ns, (sleeveNum) => {
        ns.sleeve.setToCommitCrime(sleeveNum, 'Homicide')
    })

    pp(ns, 'Waiting for negative-enough karma', true)
    while (ns.heart.break() > -54000) {
        pp(ns, `Current karma: ${ns.heart.break()}`)
        await ns.sleep(30000)
    }

    pp(ns, 'Finished waiting for karma, setting all sleeves to shock recovery')

    forEachSleeve(ns, (sleeveNum) => {
        ns.sleeve.setToShockRecovery(sleeveNum)
    })
}