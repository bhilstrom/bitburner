import { pp, Ports, readFromPort } from './common.js'

export const HacknetAction = {
    SPEND_BLADEBURNER: "SPEND_BLADEBURNER",
    UPGRADE: "UPGRADE",
}

/** @param {import(".").NS } ns */
async function upgradeHacknet(ns) {
    const hack = ns.hacknet

    // USE https://www.reddit.com/r/Bitburner/comments/v58eam/hashgainrate_returns_zero_for_all_values/
    // ns.formulas.hacknetServers.hashGainRate()

    for (let i = 0; i < hack.numNodes(); i++) {

        // const node = {
        //     cacheCost: hack.getCacheUpgradeCost(i, 1),
        //     coreCost: hack.getCoreUpgradeCost(i, 1),
        //     levelCost: hack.getLevelUpgradeCost(i, 1),
        //     ramCost: hack.getRamUpgradeCost(i, 1),
        //     stats: hack.getNodeStats(i),
        // }

        while (hack.upgradeLevel(i, 1)) {}
        while (hack.upgradeCore(i, 1)) {}
        while (hack.upgradeRam(i, 1)) {}
        while (hack.upgradeCache(i, 1)) {}
    }
}

/** @param {import(".").NS } ns */
async function spendHashes(ns) {
    const hack = ns.hacknet
    
    // hack.spendHashes('Exchange for Bladeburner Rank')
    // hack.spendHashes('Exchange for Bladeburner SP')
    hack.spendHashes('Sell for Money')
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    let currentActions = {}

    while (true) {
        await ns.sleep(500)

        await upgradeHacknet(ns)

        await spendHashes(ns)


        // const portData = readFromPort(ns, Ports.SLEEVE)
        // if (portData) {
        //     updateCurrentActions(portData, currentActions)
        // }

        // for (const action of currentActions) {

        // }
        // switch (portData) {
        //     case SleeveAction.TRAIN_HACK:
        //         pp(ns, "Got train hack request", true)
        //         break

        //     default:
        //         throw new Error(`Cannot handle port data: ${portData}`)
        // }
    }
}