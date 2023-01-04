import { pp } from './common.js'

/** @param {import(".").NS } ns */
export async function main(ns) {

    [
        "sleep",
    ].forEach(logName => ns.disableLog(logName))

    const faction = ns.args[0]

    const currentFavor = ns.singularity.getFactionFavor(faction)

    const requiredFavor = ns.getFavorToDonate()
    
    let gainedFavor = ns.singularity.getFactionFavorGain(faction)
    while ((currentFavor + gainedFavor) < requiredFavor) {
        pp(ns, `Need ${requiredFavor} favor, have ${currentFavor}, gaining ${gainedFavor}`)
        await ns.sleep(10000)
        gainedFavor = ns.singularity.getFactionFavorGain(faction)
    }

    ns.alert(`You can purchase favor from ${faction} now!`)
}