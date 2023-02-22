import { pp, Ports, readFromPort } from './common.js'
// import { trainHackingTo10 } from './main.early.js'

export const SleeveAction = {
    BLADE_CONTRACTS: "BLADE_CONTRACTS",
    BLADE_DIPLOMACY: "BLADE_DIPLOMACY",
    BLADE_REGEN: "BLADE_REGEN",
    BLADE_RESEARCH: "BLADE_RESEARCH",
    TRAIN_HACK: "TRAIN_HACK",
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    ns.clearPort(Ports.SLEEVE)

    /*
    * General notes:
    * - 4 sleeves doing "Infiltrate Synthoids" creates excess Assassin contracts with Overclock level 90.
    */

    while (true) {
        await ns.sleep(500)

        const portData = readFromPort(ns, Ports.SLEEVE)
        if (!portData) {
            continue
        }

        switch (portData) {
            case SleeveAction.TRAIN_HACK:
                pp(ns, "Got train hack request", true)
                break

            default:
                throw new Error(`Cannot handle port data: ${portData}`)
        }
    }
}
