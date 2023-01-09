import { pp } from './common.js'

const CSEC = 'CyberSec'

const CRIME_NAMES_MAP = {
    'Shoplift': 'SHOPLIFT',
    'Rob Store': 'ROBSTORE',
    'Mug': 'MUG',
    'Larceny': 'LARCENY',
    'Deal Drugs': 'DRUGS',
    'Bond Forgery': 'BONDFORGERY',
    'Traffick Arms': 'TRAFFICKARMS',
    'Homicide': 'HOMICIDE',
    'Grand Theft Auto': 'GRANDTHEFTAUTO',
    'Kidnap': 'KIDNAP',
    'Assassination': 'ASSASSINATION',
    'Heist': 'HEIST',
}

const FACTIONS_WITH_NO_CONFLICTS = [
    'CyberSec',
    'Tian Di Hui',
    'Netburners',
    'Shadows of Anarchy',
    'Slum Snakes',
    'Tetrads',
    'Silhouette',
    'Speakers for the Dead',
    'The Dark Army',
    'The Syndicate',
    'NiteSec',
    'The Black Hand',
    'BitRunners',
    'ECorp',
    'MegaCorp',
    'KuaiGong International',
    'Four Sigma',
    'NWO',
    'Blade Industries',
    'OmniTek Incorporated',
    'Bachman & Associates',
    'Clarke Incorporated',
    'Fulcrum Secret Technologies',
    'The Covenant',
    'Daedalus',
    'Illuminati',

]

/** @param {import(".").NS } ns */
function joinMostFactions(ns) {
    ns.singularity.checkFactionInvitations()
        .filter(faction => FACTIONS_WITH_NO_CONFLICTS.includes(faction))
        .forEach(faction => ns.singularity.joinFaction(faction))
}

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
    const currentWork = ns.singularity.getCurrentWork()
    if (currentWork !== null && currentWork.type == 'CRIME' && CRIME_NAMES_MAP[targetCrime] === currentWork.crimeType) {
        return
    }

    ns.singularity.commitCrime(targetCrime, false)
}

/** @param {import(".").NS } ns */
async function commitCrimeUntilCSEC(ns) {

    // If we already have faction rep with CSEC, we already joined them
    if (ns.singularity.getFactionRep(CSEC) > 0) {
        return
    }

    while (!ns.singularity.workForFaction(CSEC, 'Hacking contracts', false)) {
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

    ns.singularity.workForFaction(CSEC, 'Hacking contracts', false)

    while(true) {
        joinMostFactions(ns)
        await ns.sleep(10 * 1000)
    }
}