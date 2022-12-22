import { pp } from './common.js'

/** @param {import(".").NS } ns */
export async function main(ns) {

    ns.disableLog('sleep')

    while (ns.heart.break() > -54000) {
        pp(ns, `Current karma: ${ns.heart.break()}`)
        await ns.sleep(30000)
    }

    pp(ns, 'Finished waiting for karma, setting all sleeves to shock recovery')

    const numSleeves = ns.sleeve.getNumSleeves()

    for (let sleeveNumber = 0; sleeveNumber < numSleeves; sleeveNumber++) {
        // if (isHomicideGuaranteed(ns, sleeveNumber)) {
        //     return
        // }

        // ns.sleeve.setToFactionWork(sleeveNumber, 'Slum Snakes', 'Field Work')
        ns.sleeve.setToShockRecovery(sleeveNumber)
    }
}