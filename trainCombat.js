import { pp } from './common.js'

/** @param {import(".").NS } ns */
export async function main(ns) {

    const statResult = ns.args[0]

    const combatStats = [
        'strength',
        'defense',
        'dexterity',
        'agility',
    ]

    for (let i = 0; i < combatStats.length; i++) {
        const combatStat = combatStats[i]

        if (ns.getPlayer().skills[combatStat] >= statResult) {
            pp(ns, `Stat ${combatStat} already above ${statResult}, no change.`, true)
        } else {
            pp(ns, `Training ${combatStat} to ${statResult}...`, true)
            ns.singularity.gymWorkout('Powerhouse Gym', combatStat)
            while (ns.getPlayer().skills[combatStat] < statResult) {
                await ns.sleep(500)
            }
            ns.singularity.stopAction()
            pp(ns, `... training ${combatStat} complete!`, true)
        }
    }
}