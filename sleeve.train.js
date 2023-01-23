import { forEachSleeve, hasFormulasAccess, pp } from './common.js'

/** @param {import(".").NS } ns */
function trainHacking(ns, sleeveNumber) {
    ns.sleeve.setToUniversityCourse(sleeveNumber, ns.enums.LocationName.Sector12RothmanUniversity, 'Study Computer Science')
}

function getDefaultWorkTypes() {
    // Over time, sleeves will greatly exceed our skills in security work due to augs.
    // We prioritize field work over security just because it also helps our hacking.
    // Hacking is a last resort, as sleeves are never very good at it.
    return [
        ns.enums.FactionWorkType.field,
        ns.enums.FactionWorkType.security,
        ns.enums.FactionWorkType.hacking,
    ]
}

/** @param {import(".").NS } ns */
function workForFaction(ns, sleeveNumber, faction, workTypes) {

    for (let i = 0; i < workTypes.length; i++) {
        const workType = workTypes[i]

        let result = false
        try {
            result = ns.sleeve.setToFactionWork(sleeveNumber, faction, workType)
        } catch (error) {
            // These can pop up after joining a new faction,
            // because a sleeve can be assigned to what a different sleeve is already doing.
            // This should resolve after a few iterations, as the different sleeves get assigned
            // their new work and free up their old work.
            pp(ns, `Error assigning work: ${error}`)
        }

        if (result) {
            pp(ns, `Assigned sleeve ${sleeveNumber} to ${workType} work for ${faction}`)
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

export function assignAllSleeves(ns, workTypes = undefined) {
    workTypes = workTypes || getDefaultWorkTypes()

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
            while (faction && !factions.includes(faction)) {
                faction = priorityFactions.shift()
            }

            // If we don't have any priority factions, just work for the first one.
            if (!faction || !factions.includes(faction)) {
                faction = factions.shift()
            }

            // If we don't have ANY faction to work for, Mug people.
            if (!faction) {
                ns.sleeve.setToCommitCrime(sleeveNum, ns.enums.CrimeType.mug)
                return
            }

            workForFaction(ns, sleeveNum, faction, workTypes) 
            
            // Remove the faction from the list.
            // We don't care if the work assignment was successful or not,
            // because any errors will get retried in the next loop.
            factions = factions.filter(option => option != faction)
        }
    })
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
        assignAllSleeves(ns)

        await ns.sleep(30 * 1000)
    }
}