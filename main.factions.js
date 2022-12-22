import { pp } from './common.js'

/** @param {import(".").NS } ns */
async function waitUntilHacking10(ns) {

    if (ns.getHackingLevel() >= 10) {
        pp(ns, 'Hack level is already 10 or above')
        return
    }

    pp(ns, `Hacking level less than 10, waiting`)
    while (ns.getHackingLevel() < 10) {
        await ns.sleep(1000)
    }
}

/** @param {import(".").NS } ns */
function commitCrime(ns) {
    const upgradedCrimes = [
        'Homicide',
        'Larceny',
        'Rob store',
    ]

    let targetCrime = 'Shoplift'
    for (let i = 0; i < upgradedCrimes.length; i++) {
        let crime = upgradedCrimes[i]
        if (ns.singularity.getCrimeChance(crime) > 0.9) {
            targetCrime = crime
            break
        }
    }
    
    // If the player is currently doing that work, don't restart it
    // ns.singularity.getCurrentWork()

    ns.singularity.commitCrime(targetCrime, false)
}

/** @param {import(".").NS } ns */
async function commitCrimeUntilCSEC(ns) {

    // If we already have faction rep with CSEC, we already joined them
    if (ns.singularity.getFactionRep('CSEC') > 0) {
        return
    }

    while (!ns.singularity.workForFaction('CSEC', 'Hacking contracts', false)) {
        commitCrime(ns)
        await ns.sleep(1000)
    }
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    [
        "sleep",
    ].forEach(logName => ns.disableLog(logName))

    // main.early trains hacking to 10, wait for that to be completed as that's the most important thing
    await waitUntilHacking10(ns)

    await commitCrimeUntilCSEC(ns)

    ns.singularity.workForFaction('CSEC', 'Hacking contracts', false)

    /* Script
    Sleeve thread:
    Shock recovery down to 5
    If no gang:
        Train skills up to homicide
        Murder until we can start a gang
    Else:
        Hack factions or university


    Faction thread:
    train hacking to 10
    shoplift until robbing a store has 100% success
    rob store
    (wait until CSEC)
    hacking CSEC

    Hacking thread:
    (wait until hacking 10)
    run spider, then formulaHack joesguns
    buy tor router
    buy BruteSSH
    run spider, restart formulaHack joesguns because of new servers available
    (wait until CSEC)
    backdoor CSEC
    join CSEC
    (wait until avm)
    backdoor avm
    join avm
    */
}