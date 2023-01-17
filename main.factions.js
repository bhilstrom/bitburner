import { pp } from './common.js'

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
export async function main(ns) {

    [
        "sleep",
    ].forEach(logName => ns.disableLog(logName))

    while(true) {
        joinMostFactions(ns)
        await ns.sleep(10 * 1000)
    }
}