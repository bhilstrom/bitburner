import { pp, Ports, readFromPort } from './common.js'

export const HacknetAction = {
    SPEND_BLADEBURNER: "SPEND_BLADEBURNER",
    UPGRADE: "UPGRADE",
}

/** @param {import(".").NS } ns */
function upgradeCore(ns, index) {
    ns.hacknet.upgradeCore(index, 1)
}

/** @param {import(".").NS } ns */
function upgradeLevel(ns, index) {
    ns.hacknet.upgradeLevel(index, 1)
}

/** @param {import(".").NS } ns */
function upgradeRam(ns, index) {
    ns.hacknet.upgradeRam()
}

/** @param {import(".").NS } ns */
async function upgradeHacknet(ns) {
    const hack = ns.hacknet
    const formula = ns.formulas.hacknetServers

    const productionMult = ns.getHacknetMultipliers().production
    const nodes = []
    for (let i = 0; i < hack.numNodes(); i++) {

        const stats = hack.getNodeStats(i)
        const node = {
            production: stats.production,
            costCache: hack.getCacheUpgradeCost(i, 1),
            cache: stats.cache,
            costCore: hack.getCoreUpgradeCost(i, 1),
            cores: stats.cores,
            costLevel: hack.getLevelUpgradeCost(i, 1),
            level: stats.level,
            costRam: hack.getRamUpgradeCost(i, 1),
            ram: stats.ram,
            index: i,
        }

        const currentGainRate = formula.hashGainRate(node.level, 0, node.ram, node.cores, productionMult)

        node.gainCore = formula.hashGainRate(node.level, 0, node.ram, node.cores + 1, productionMult) - currentGainRate
        node.gainLevel = formula.hashGainRate(node.level + 1, 0, node.ram, node.cores, productionMult) - currentGainRate
        node.gainRam = formula.hashGainRate(node.level, 0, node.ram * 2, node.cores, productionMult) - currentGainRate

        node.effCore = node.gainCore / node.costCore
        node.effLevel = node.gainLevel / node.costLevel
        node.effRam = node.gainRam / node.costRam

        node.maxEff = node.effCore
        node.maxEffName = "cores"
        node.purchaseMaxEffFunc = ns.hacknet.upgradeCore

        if (node.effLevel > node.maxEff) {
            node.maxEff = node.effLevel
            node.maxEffName = "level"
            node.purchaseMaxEffFunc = ns.hacknet.upgradeLevel
        }

        if (node.effRam > node.maxEff) {
            node.maxEff = node.effRam
            node.maxEffName = "ram"
            node.purchaseMaxEffFunc = ns.hacknet.upgradeRam
        }

        nodes.push(node)
        // while (hack.upgradeLevel(i, 1)) {}
        // while (hack.upgradeCore(i, 1)) {}
        // while (hack.upgradeRam(i, 1)) {}
        // while (hack.upgradeCache(i, 1)) {}
    }

    nodes.sort((a, b) => b.maxEff - a.maxEff)

    pp(ns, JSON.stringify(nodes, null, 2))

    const nodeToUpgrade = nodes[0]
    pp(ns, `Upgrading ${nodeToUpgrade.maxEffName} on hacknet ${nodeToUpgrade.index}`)
    eval(nodeToUpgrade.purchaseMaxEffFunc)(nodeToUpgrade.index, 1)
}

/** @param {import(".").NS } ns */
async function spendHashes(ns) {
    const hack = ns.hacknet
    
    // hack.spendHashes('Exchange for Bladeburner Rank')
    // hack.spendHashes('Exchange for Bladeburner SP')
    hack.spendHashes('Sell for Money', undefined, Math.floor(hack.numHashes() / 4))
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    [
        "sleep",
    ].forEach(logName => ns.disableLog(logName))

    let currentActions = {}

    while (true) {
        await ns.sleep(500)

        // await upgradeHacknet(ns)

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