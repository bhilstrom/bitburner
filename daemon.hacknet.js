import { pp, Ports, readFromPort } from './common.js'

export const HacknetAction = {
    SPEND_BLADEBURNER: "SPEND_BLADEBURNER",
    SPEND_CORP: "SPEND_CORP",
    SPEND_GYM: "SPEND_GYM",
    SPEND_MONEY: "SPEND_MONEY",
    SPEND_OFF: "SPEND_OFF",
    UPGRADE_ON: "UPGRADE_ON",
    UPGRADE_OFF: "UPGRADE_OFF",
}

const SPEND_ACTIONS = [
    HacknetAction.SPEND_BLADEBURNER,
    HacknetAction.SPEND_CORP,
    HacknetAction.SPEND_GYM,
    HacknetAction.SPEND_MONEY,
    HacknetAction.SPEND_OFF,
]

function triggerSpendAction(newSpendAction, currentActions) {
    for (const spendAction of SPEND_ACTIONS) {
        currentActions[spendAction] = false
    }

    currentActions[newSpendAction] = true
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
    }

    nodes.sort((a, b) => b.maxEff - a.maxEff)

    pp(ns, JSON.stringify(nodes, null, 2))

    const nodeToUpgrade = nodes[0]
    pp(ns, `Upgrading ${nodeToUpgrade.maxEffName} on hacknet ${nodeToUpgrade.index}`)
    eval(nodeToUpgrade.purchaseMaxEffFunc)(nodeToUpgrade.index, 1)
}

/** @param {import(".").NS } ns */
async function spendHashes(ns, currentActions) {
    const hack = ns.hacknet

    const desiredUpgrades = []

    if (currentActions[HacknetAction.SPEND_BLADEBURNER]) {
        desiredUpgrades.push('Exchange for Bladeburner Rank')
        desiredUpgrades.push('Exchange for Bladeburner SP')
    }

    if (currentActions[HacknetAction.SPEND_CORP]) {
        hack.spendHashes('Exchange for Corporation Research')
    }

    if (currentActions[HacknetAction.SPEND_MONEY]) {
        hack.spendHashes('Sell for Money', undefined, Math.floor(hack.numHashes() / 4))
    }

    if (currentActions[HacknetAction.SPEND_GYM]) {
        hack.spendHashes('Improve Gym Training')
    }

    let numHashes = hack.numHashes()
    for (const upgrade of desiredUpgrades) {
        const cost = hack.hashCost(upgrade, 1)
        if (cost > numHashes) {
            pp(ns, `${numHashes}/${cost} hashes to purchase '${upgrade}'`)
        } else {
            hack.spendHashes(upgrade)
            numHashes -= cost
        }
    }
}

function updateCurrentActions(portData, currentActions) {

    if (SPEND_ACTIONS.includes(portData)) {
        triggerSpendAction(portData, currentActions)
        return
    }

    switch (portData) {
        case HacknetAction.UPGRADE_OFF:
            currentActions[HacknetAction.UPGRADE_ON] = false
            break
        case HacknetAction.UPGRADE_ON:
            currentActions[HacknetAction.UPGRADE_ON] = true
            break
        default:
            throw new Error(`Unhandled port data: ${portData}`)
    }
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    [
        "sleep",
    ].forEach(logName => ns.disableLog(logName))

    let currentActions = {}

    while (true) {
        await ns.sleep(500)

        const portData = readFromPort(ns, Ports.HACKNET)
        if (portData) {
            pp(ns, `Received port data: ${portData}`)
            updateCurrentActions(portData, currentActions)
        }

        pp(ns, `Current actions: ${JSON.stringify(currentActions, null, 2)}`)

        if (currentActions.UPGRADE_ON) {
            await upgradeHacknet(ns)
        }

        await spendHashes(ns, currentActions)
    }
}