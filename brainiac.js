import { pp, Ports } from './common.js'
import { SleeveAction } from './daemon.sleeve.js'
// import { trainHackingTo10 } from './main.early.js'

/** @param {import(".").NS } ns */
export async function main(ns) {

    ns.clearPort(Ports.SLEEVE)

    let lastCodingContractRun
    const codingContractSleep = 1000 * 60 * 5

    while (true) {
        // ns.writePort(Ports.SLEEVE, SleeveAction.TRAIN_HACK)

        if (!lastCodingContractRun || (new Date() - lastCodingContractRun > codingContractSleep)) {
            lastCodingContractRun = new Date()
            ns.exec('codingContracts.js', 'home', 1)
        }

        await ns.sleep(1000)
    }
}