import { pp } from './common.js'

/** @param {import(".").NS } ns */
export async function main(ns) {

    const statResult = ns.args[0] || 100

    const combatStats = [
        'strength',
        'defense',
        'dexterity',
        'agility',
    ]

    for (const combatStat of combatStats) {
        if (ns.getPlayer().skills[combatStat] >= statResult) {
            pp(ns, `Stat ${combatStat} already above ${statResult}, no change.`, true)
        } else {
            pp(ns, `Training ${combatStat} to ${statResult}...`, true)
            
            if (!ns.singularity.gymWorkout('Powerhouse Gym', combatStat)) {
                throw new Error("Failed to start workout. Are you in Sector-12?")
            }
            while (ns.getPlayer().skills[combatStat] < statResult) {
                await ns.sleep(500)
            }
            ns.singularity.stopAction()
            pp(ns, `... training ${combatStat} complete!`, true)
        }
    }
}