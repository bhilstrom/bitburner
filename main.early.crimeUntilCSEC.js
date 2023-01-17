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
        ns.enums.CrimeType.homicide,
        ns.enums.CrimeType.larceny,
        ns.enums.CrimeType.robStore
    ]

    let targetCrime = ns.enums.CrimeType.shoplift
    for (let i = 0; i < upgradedCrimes.length; i++) {
        let crime = upgradedCrimes[i]
        if (ns.singularity.getCrimeChance(crime) > 0.9) {
            targetCrime = crime
            break
        }
    }

    // If the player is currently doing that work, don't restart it
    const currentWork = ns.singularity.getCurrentWork()

    if (currentWork !== null && currentWork.type == 'CRIME' && targetCrime === currentWork.crimeType) {
        return
    }

    ns.singularity.commitCrime(targetCrime, false)
}

/** @param {import(".").NS } ns */
async function commitCrimeUntilCSEC(ns) {
    while (!ns.singularity.workForFaction('CyberSec', 'Hacking contracts', false)) {
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
}