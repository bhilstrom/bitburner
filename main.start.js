import { pp } from './common.js'

/** @param {import(".").NS } ns */
export async function main(ns) {

    [
        "sleep",
    ].forEach(logName => ns.disableLog(logName))

    ns.exec('main.early.js', 'home')
    ns.exec('sleeve.train.js', 'home')
    ns.exec('main.factions.js', 'home')

    /* Script
    Sleeve thread:
    Shock recovery down to 5
    If no gang:
        Train skills up to homicide
        Murder until we can start a gang
    Else:
        Hack factions or university


    Faction thread:
    train hacking to 10
    shoplift until robbing a store has 100% success
    rob store
    (wait until CSEC)
    hacking CSEC

    Hacking thread:
    (wait until hacking 10)
    run spider, then formulaHack joesguns
    buy tor router
    buy BruteSSH
    run spider, restart formulaHack joesguns because of new servers available
    (wait until CSEC)
    backdoor CSEC
    join CSEC
    (wait until avm)
    backdoor avm
    join avm
    */
}