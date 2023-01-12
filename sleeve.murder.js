import { pp } from './common.js'

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

function forEachSleeve(ns, func) {
    const numSleeves = ns.sleeve.getNumSleeves()
    for (let sleeveNum = 0; sleeveNum < numSleeves; sleeveNum++) {
        func(sleeveNum)
    }
}

/** @param {import(".").NS } ns */
async function shockRecover(ns) {

    let sleeveInShock = true // Set to true so we enter the while loop
    while (sleeveInShock) {
        sleeveInShock = false
        forEachSleeve(ns, (sleeveNum) => {
            const sleeve = ns.sleeve.getSleeve(sleeveNum)
            pp(ns, `Sleeve ${sleeveNum} shock: ${sleeve.shock}`)
            if (sleeve.shock > SHOCK_THRESHOLD) {
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

    await shockRecover(ns)

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

    ns.spawn('gang.start.js', 1)
}