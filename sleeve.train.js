import { hasFormulasAccess, pp } from './common.js'

/** @param {import(".").NS } ns */
function getUniversityGain(ns) {
    if (hasFormulasAccess(ns)) {
        return ns.formulas.work.classGains(ns.getPlayer(), 'Study Computer Science', 'Rothman University').hackExp
    }

    return 1
}

/** @param {import(".").NS } ns */
function getTrainingOptions(ns) {
    return {
        university: {
            exe: (sleeveNumber, faction) => ns.sleeve.setToUniversityCourse(sleeveNumber),
            gainPerSecond: getUniveristyGains(ns)
        },
        fieldWork: {
            exe: (sleeveNumber, faction) => ns.sleeve.setToFactionWork(sleeveNumber, faction, 'Field Work'),
            gainPerSecond: 
        }
    }
}

/** @param {import(".").NS } ns */
function trainHacking(ns, sleeveNumber) {
    ns.sleeve.setToUniversityCourse(sleeveNumber, 'Rothman University', 'Study Computer Science')
}

/** @param {import(".").NS } ns */
export async function main(ns) {



    // while (true) {
    const numSleeves = ns.sleeve.getNumSleeves()

    for (let sleeveNumber = 0; sleeveNumber < numSleeves; sleeveNumber++) {
        trainHacking(ns, sleeveNumber)
    }

    // await ns.sleep(10000)
    // }
}