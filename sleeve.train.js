import { forEachSleeve, hasFormulasAccess, pp } from './common.js'

// /** @param {import(".").NS } ns */
// function getUniversityGain(ns) {
//     if (hasFormulasAccess(ns)) {
//         return ns.formulas.work.classGains(ns.getPlayer(), 'Study Computer Science', 'Rothman University').hackExp
//     }

//     return 1
// }

// /** @param {import(".").NS } ns */
// function getTrainingOptions(ns) {
//     return {
//         university: {
//             exe: (sleeveNumber, faction) => ns.sleeve.setToUniversityCourse(sleeveNumber),
//             gainPerSecond: getUniveristyGains(ns)
//         },
//         fieldWork: {
//             exe: (sleeveNumber, faction) => ns.sleeve.setToFactionWork(sleeveNumber, faction, 'Field Work'),
//             gainPerSecond: 
//         }
//     }
// }

/** @param {import(".").NS } ns */
function trainHacking(ns, sleeveNumber) {
    ns.sleeve.setToUniversityCourse(sleeveNumber, ns.enums.LocationName.Sector12RothmanUniversity, 'Study Computer Science')
}


/** @param {import(".").NS } ns */
function workForFaction(ns, sleeveNumber, faction) {

    // Over time, sleeves will greatly exceed our skills in security work.
    // We prioritize field work over security just because it also helps our hacking.
    // Hacking is a last resort, as sleeves are never very good at it.
    const workTypes = [
        ns.enums.FactionWorkType.field,
        ns.enums.FactionWorkType.security,
        ns.enums.FactionWorkType.hacking,
    ]

    for (let i = 0; i < workTypes.length; i++) {
        const workType = workTypes[i]
        if (ns.sleeve.setToFactionWork(sleeveNumber, faction, workType)) {
            pp(ns, `Assigned sleeve ${sleeveNumber} to ${workType} work for ${faction}`, true)
            return true
        }
    }

    return false
}

function getPriorityFactions() {
    return [
        'Daedalus',
        'CyberSec',
    ]
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    // First priority: help us get to hacking level 10
    if (ns.getHackingLevel() < 10) {
        forEachSleeve(ns, (sleeveNum) => {
            trainHacking(ns, sleeveNum)
        })

        while (ns.getHackingLevel() < 10) {
            await ns.sleep(10 * 1000)
        }
    }

    while (true) {
        const priorityFactions = getPriorityFactions()
        let factions = ns.getPlayer().factions

        if (ns.gang.inGang()) {
            const gangFaction = ns.gang.getGangInformation().faction
            factions = factions.filter(faction => gangFaction != faction)
        }

        forEachSleeve(ns, (sleeveNum) => {

            const sleeve = ns.sleeve.getSleeve(sleeveNum)
            if (sleeve.shock > 5) {
                pp(ns, `Sleeve ${sleeveNum} has shock ${sleeve.shock}, recovering`)
                ns.sleeve.setToShockRecovery(sleeveNum)
            } else {

                // Work for the first available priority faction, if we can.
                let faction = priorityFactions.shift()
                while (faction && !faction.includes(faction)) {
                    faction = priorityFactions.shift()
                }

                // If we don't have any priority factions, just work for the first one.
                if (!faction || !factions.includes(faction)) {
                    faction = factions.shift()
                }

                // If we don't have ANY faction to work for, do nothing.
                if (!faction) {
                    return
                }

                // If we successfully worked for the faction,
                // remove it from the options for the rest of the sleeves.
                if (workForFaction(ns, sleeveNum, faction)) {
                    factions = factions.filter(option => option != faction)
                }
            }
        })

        await ns.sleep(30 * 1000)
    }
}