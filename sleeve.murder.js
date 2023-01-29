import { pp, forEachSleeve } from './common.js'
import { assignAllSleeves } from './sleeve.train.js'

const STAT_THRESHOLD = 140
const SHOCK_THRESHOLD = 60

/** @param {import(".").NS } ns */
function anySleeveBelowThreshold(ns) {

    const homicideStats = [
        'strength',
        'defense',
        'dexterity',
        'agility'
    ]

    let anyBelowThreshold = false
    forEachSleeve(ns, (sleeveNum) => {
        const sleeveSkills = ns.sleeve.getSleeve(sleeveNum).skills
        if (homicideStats.some(stat => sleeveSkills[stat] < STAT_THRESHOLD)) {
            anyBelowThreshold = true
        }
    })

    return anyBelowThreshold
}

/** @param {import(".").NS } ns */
async function shockRecover(ns, threshold) {

    threshold = threshold || SHOCK_THRESHOLD

    let sleeveInShock = true // Set to true so we enter the while loop
    while (sleeveInShock) {
        sleeveInShock = false
        forEachSleeve(ns, (sleeveNum) => {
            const sleeve = ns.sleeve.getSleeve(sleeveNum)
            pp(ns, `Sleeve ${sleeveNum} shock: ${sleeve.shock}`)
            if (sleeve.shock > threshold) {
                pp(ns, `Sleeve ${sleeveNum} is still over ${SHOCK_THRESHOLD} shock.`)
                sleeveInShock = true
                ns.sleeve.setToShockRecovery(sleeveNum)
            }
        })

        // Don't wait for no reason
        if (sleeveInShock) {
            await ns.sleep(30 * 1000)
        }
    }

    pp(ns, `All sleeves under ${SHOCK_THRESHOLD} shock, continuing.`)
}

/** @param {import(".").NS } ns */
async function recoverAndWorkUntilThreshold(ns) {

    if (!anySleeveBelowThreshold(ns)) {
        pp(ns, `All sleeve stats above ${STAT_THRESHOLD}`, true)
        return
    }

    pp(ns, `Waiting for all stats to be ${STAT_THRESHOLD} or above`, true)

    // Security work gains crime stats faster.
    // Field work is acceptable.
    // Don't bother with hacking, we'd prefer to commit crime in that case.
    const workTypes = [
        ns.enums.FactionWorkType.security,
        ns.enums.FactionWorkType.field
    ]

    // Stop when either:
    // 1. All sleeves are above the state threshold for the desired crime.
    // 2. Our karma is below the threshold for starting a gang.
    while (anySleeveBelowThreshold(ns) && karmaAboveThreshold(ns)) {
        await assignAllSleeves(ns, workTypes, SHOCK_THRESHOLD)
        await ns.sleep(30 * 1000)
    }

    if (!anySleeveBelowThreshold) {
        pp(ns, `All stats ${STAT_THRESHOLD} or above!`, true)
    }
}

/** @param {import(".").NS } ns */
function karmaAboveThreshold(ns) {
    return ns.heart.break() > -54_000
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    ns.disableLog('sleep')

    await recoverAndWorkUntilThreshold(ns)

    pp(ns, 'Starting homicides', true)
    forEachSleeve(ns, (sleeveNum) => {
        ns.sleeve.setToCommitCrime(sleeveNum, 'Homicide')
    })

    pp(ns, 'Waiting for negative-enough karma', true)
    while (karmaAboveThreshold()) {
        pp(ns, `Current karma: ${ns.heart.break()}`)
        await ns.sleep(30000)
    }

    pp(ns, 'Finished waiting for karma, setting all sleeves to shock recovery')
    forEachSleeve(ns, (sleeveNum) => {
        ns.sleeve.setToShockRecovery(sleeveNum)
    })

    ns.exec('gang.start.js', 'home', 1)
    ns.spawn('sleeve.train.js', 1)
}