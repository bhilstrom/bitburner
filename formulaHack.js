import { hasFormulasAccess, settings, getItem, pp } from './common.js'

const hackingScripts = ['hack.js', 'grow.js', 'weaken.js', 'common.js', 'hack.batch.js', 'grow.batch.js', 'weaken.batch.js']

/** @param {import(".").NS } ns */
function getRootedServers(ns, servers) {

    // Only include servers:
    // - With root access
    // - That have more than 1 ram
    // - That aren't scheduled for decommission (other than home)
    const rootServers = Object.keys(servers)
        .filter((hostname) => ns.serverExists(hostname))
        .filter((hostname) => ns.hasRootAccess(hostname))
        .filter((hostname) => servers[hostname].ram >= 2)
        .filter((hostname) => hostname === 'home' || !ns.fileExists(settings().decommissionFilename, hostname))

    // Copy hacking scripts to rooted servers
    rootServers
        .filter(hostname => hostname !== "home")
        .forEach(hostname => ns.scp(hackingScripts, hostname))

    // Send scripts to:
    // - biggest servers first
    // - with 'home' last (we want to reserve it for grow scripts)
    rootServers.sort((a, b) => {
        if (b === 'home') {
            return -1
        } else if (a === 'home') {
            return 1
        }

        return servers[b].ram - servers[a].ram
    })
    return rootServers
}

/**
 * @param {import(".").NS } ns
 * @param {import(".").Server} server
 * @param {import(".").Player} server
 */
function getActionTimes(ns, server, player) {
    // If we have access to Formulas, use the more accurate version.
    // If not, use the basic version.

    // Order is specifically: weaken, grow, hack
    // In case we happen to level up in between determing times, weaken should take the longest
    if (hasFormulasAccess(ns)) {
        return {
            weaken: ns.formulas.hacking.weakenTime(server, player),
            grow: ns.formulas.hacking.growTime(server, player),
            hack: ns.formulas.hacking.hackTime(server, player),
        }
    }

    return {
        weaken: ns.getWeakenTime(server.hostname),
        grow: ns.getGrowTime(server.hostname),
        hack: ns.getHackTime(server.hostname),
    }
}

/** @param {import(".").NS } ns */
function findWeightedTargetServers(ns, rootedServers, servers, serverExtraData) {

    const hackingLevel = ns.getHackingLevel()

    rootedServers = rootedServers
        .filter((hostname) => servers[hostname].hackingLevel <= hackingLevel)
        .filter((hostname) => servers[hostname].maxMoney)
        .filter((hostname) => hostname !== "home")
        .filter((hostname) => ns.getWeakenTime(hostname) < settings().maxWeakenTime)

    let weightedServers = rootedServers.map((hostname) => {

        // Get the number of full hack cycles it would take to take all the money
        const fullHackCycles = Math.ceil(100 / Math.max(0.00000001, ns.hackAnalyze(hostname)))

        serverExtraData[hostname] = {
            fullHackCycles,
        }

        const serverValue = servers[hostname].maxMoney * (settings().minSecurityWeight / (servers[hostname].minSecurityLevel + ns.getServerSecurityLevel(hostname)))

        return {
            hostname,
            serverValue,
            minSecurityLevel: servers[hostname].minSecurityLevel,
            securityLevel: ns.getServerSecurityLevel(hostname),
            maxMoney: servers[hostname].maxMoney,
        }
    })

    weightedServers.sort((a, b) => b.serverValue - a.serverValue)
    // pp(ns, `Weighted servers: ${JSON.stringify(weightedServers, null, 2)}`)

    return weightedServers.map((server) => server.hostname)
}

/**
 * @param {import(".").NS } ns
 */
function getAvailableRam(ns, rootedServers) {

    const ramMap = {}
    rootedServers.forEach(hostname => {
        const server = ns.getServer(hostname)

        let available = server.maxRam - server.ramUsed
        if (hostname == 'home') {
            available -= settings().homeRamReserved
        }

        ramMap[hostname] = available
    })
    return ramMap
}

/**
 * 
 * @param {import(".").NS } ns
 * @param {import(".").Server} target
 */
function distributeBatch(ns, target, rootedServers, actionStats, availableRam, batch, allowGrowOnOtherServers = false, awakenTime = undefined) {

    const bufferMs = 200
    let currentTime = awakenTime !== undefined ? awakenTime : performance.now()
    let nextLanding = currentTime + actionStats.weaken.time + (bufferMs * 4)
    let batchToExecute = []

    let anyHack = false
    for (let hostname of rootedServers) {
        if (batch.hack <= 0) {
            break
        }

        // Hacks must all be executed on the same server, because they're exponential
        const ramRequired = batch.hack * actionStats.hack.ram
        if (availableRam[hostname] < ramRequired) {
            continue
        }

        anyHack = true

        batchToExecute.push({
            attacker: hostname,
            action: 'hack',
            threads: batch.hack,
            landing: nextLanding - (bufferMs * 4)
        })

        availableRam[hostname] -= batch.hack * actionStats.hack.ram
        batch.hack = 0
    }

    // Ideally, growth is executed on 'home'
    // It's exponential, and home gets weird bonuses to grow sometimes.
    let growThreadsAvailable = Math.floor(availableRam.home / actionStats.grow.ram)
    let growTheadsToExecute = Math.min(growThreadsAvailable, batch.grow)
    let anyGrow = false
    if (batch.grow > 0 && growTheadsToExecute > 0) {
        batchToExecute.push({
            attacker: 'home',
            action: 'grow',
            threads: growTheadsToExecute,
            landing: nextLanding - (bufferMs * 2) // Grow happens after hack and first weaken
        })

        anyGrow = true

        availableRam.home -= (growTheadsToExecute * actionStats.grow.ram)
        batch.grow -= growTheadsToExecute
    }

    // Weakens execute on any server
    let anyWeaken1 = false
    let anyWeaken2 = false
    for (let hostname of rootedServers) {
        if (batch.weaken1 > 0) {
            anyWeaken1 = true
            batch.weaken1 = distributeWeaken(ns, batch.weaken1, hostname, availableRam, actionStats, nextLanding - (bufferMs * 3), batchToExecute)
        }

        if (batch.weaken2 > 0) {
            anyWeaken2 = true
            batch.weaken2 = distributeWeaken(ns, batch.weaken2, hostname, availableRam, actionStats, nextLanding - bufferMs, batchToExecute)
        }
    }

    // Now that the weakens have been distributed, we can fill up the servers
    // With any remaining grow attempts (if allowed)
    if (batch.grow > 0 && allowGrowOnOtherServers) {
        for (let hostname of rootedServers) {
            growThreadsAvailable = Math.floor(availableRam[hostname] / actionStats.grow.ram)
            growTheadsToExecute = Math.min(growThreadsAvailable, batch.grow)

            if (growTheadsToExecute > 0) {
                batchToExecute.push({
                    attacker: hostname,
                    action: 'grow',
                    threads: growTheadsToExecute,
                    landing: nextLanding + (bufferMs * 2) // Same as the grow from earlier
                })
                availableRam[hostname] -= (growTheadsToExecute * actionStats.grow.ram)
                batch.grow -= growTheadsToExecute
            }
        }
    }

    // If any portion of the batch could not be accounted for, don't actually execute.
    // Just return the remaining amount, and we'll catch it in the next loop.
    // This only applies if grow can only happen on the home server.
    // If grow CAN happen on other servers, it means we're doing the preparation batch and need all the threads we can get.
    if (!allowGrowOnOtherServers && (batch.hack > 0 || batch.grow > 0 || batch.weaken1 > 0 || batch.weaken2 > 0)) {
        pp(ns, `Unable to fully distribute batch: ${JSON.stringify(batch, null, 2)}`)
        return nextLanding + bufferMs
    }

    // pp(ns, `Batch: ${JSON.stringify(batchToExecute, null, 2)}`, true)
    // pp(ns, `Remaining batch: ${JSON.stringify(batch, null, 2)}`, true)

    // Actually distribute the commands
    for (let cmd of batchToExecute) {
        // pp(ns, `Executing against ${target.hostname}: ${JSON.stringify(cmd, null, 2)}`, true)
        if (!cmd.attacker) {
            pp(ns, `Cmd is missing attacker. cmd: ${JSON.stringify(cmd, null, 2)}, batch: ${JSON.stringify(batchToExecute, null, 2)}`, true)
        }
        ns.exec(actionStats[cmd.action].script, cmd.attacker, cmd.threads, target.hostname, cmd.landing)
    }

    // Figure out how many actions actually ran so we know how long to delay
    let actionsExecuted = 0
    if (anyHack) {
        actionsExecuted += 1
    }
    if (anyGrow) {
        actionsExecuted += 1
    }
    if (anyWeaken1) {
        actionsExecuted += 1
    }
    if (anyWeaken2) {
        actionsExecuted += 1
    }

    // If we don't need to delay, just return the current time so we don't stall needlessly
    if (actionsExecuted > 0) {
        return nextLanding + (bufferMs * (actionsExecuted + 1))
    } else {
        return performance.now()
    }
}

/**
 * @param {import(".").NS } ns
 */
function distributeWeaken(ns, threads, hostname, availableRam, actionStats, landing, batchToExecute) {

    let threadsAvailable = Math.floor(availableRam[hostname] / actionStats.weaken.ram)

    let threadsToExecute = Math.min(threads, threadsAvailable)

    if (threadsToExecute > 0) {
        batchToExecute.push({
            attacker: hostname,
            action: 'weaken',
            threads: threadsToExecute,
            landing: landing
        })

        availableRam[hostname] -= (threadsToExecute * actionStats.weaken.ram)
        pp(ns, `Distributed ${threadsToExecute} threads, ${threads - threadsToExecute} remaining`)
    }
    return threads - threadsToExecute
}

/**
 * @param {import(".").NS } ns
 * @param {import(".").Server} home
 * @param {import(".").Server} target
 */
function getGrowThreadsRequired(ns, target, startingMoney, desiredMoney, cores = 1) {
    pp(ns, `Getting grow threads on ${target.hostname}: starting ${startingMoney} desired ${desiredMoney} cores ${cores}`)
    const growthAmount = desiredMoney - startingMoney

    if (growthAmount <= 0) {
        return 0
    }

    if (!Number.isFinite(growthAmount)) {
        growthAmount = Number.MAX_SAFE_INTEGER - 1
    }

    // growthAnalyze takes a growth FACTOR, not a growth amount
    let growthFactorWanted = desiredMoney / startingMoney
    if (!Number.isFinite(growthFactorWanted)) {
        growthFactorWanted = Number.MAX_SAFE_INTEGER - 1
    }

    return Math.ceil(ns.growthAnalyze(target.hostname, growthFactorWanted, cores))

}

/**
 * 
 * @param {import(".").NS } ns
 */
async function prepareAndHackTarget(ns, rootedServers, targetHostname, actionStats, desired) {

    let target = ns.getServer(targetHostname)
    const player = ns.getPlayer()
    let home = ns.getServer('home')

    // Get the time it would take to run each script against the server
    const actionTimes = getActionTimes(ns, target, player)
    // pp(ns, `${JSON.stringify(actionTimes, null, 2)}`, true)
    Object.keys(actionTimes).forEach(action => {
        actionStats[action].time = actionTimes[action]
    })

    // Prepare server
    // Set so we enter the while loop and get the REAL values
    let weakenThreadsForMinimum = 1
    let growThreads = 0
    let weakenThreadsForGrow = 0
    let availableRam = {}
    // pp(ns, `ZERO. weakenMin: ${weakenThreadsForMinimum}, grow: ${growThreads}, weakenGrow: ${weakenThreadsForGrow}`, true)
    let awakenFromPrepareBatchAt = undefined
    while (weakenThreadsForMinimum > 0 || growThreads > 0 || weakenThreadsForGrow > 0) {

        // Update server data, a lot changes in the early game
        const serverData = updateServerData(ns, desired)
        rootedServers = serverData[1]

        availableRam = getAvailableRam(ns, rootedServers)

        let prepareTargetBatch = {
            hack: 0
        }

        // pp(ns, `ONE. weakenMin: ${weakenThreadsForMinimum}, grow: ${growThreads}, weakenGrow: ${weakenThreadsForGrow}`, true)
        // pp(ns, `ONE`)
        // Weaken ALWAYS lowers the security level of the target by 0.05
        // https://github.com/danielyxie/bitburner/blob/master/markdown/bitburner.ns.weaken.md
        weakenThreadsForMinimum = Math.ceil((target.hackDifficulty - target.minDifficulty) / .05)
        prepareTargetBatch.weaken1 = weakenThreadsForMinimum

        // By using home's cores, this is the minimum number of grow threads.
        // If the home server fills up, we'll distribute these to other servers.
        // Any remaining threads will be handled when we loop again,
        // so the accuracy of "did we use the cores" is unimportant.
        if (desired !== 'xp') {
            const desiredMoney = target.moneyMax * settings().maxMoneyMultiplier
            growThreads = getGrowThreadsRequired(ns, target, target.moneyAvailable, desiredMoney, home.cpuCores)
            prepareTargetBatch.grow = growThreads

            // This method optionally takes 'cores', but ideally weaken is distributed to machines other than 'home'
            weakenThreadsForGrow = Math.ceil(ns.growthAnalyzeSecurity(growThreads, target.hostname, 1) / 0.05)
            prepareTargetBatch.weaken2 = weakenThreadsForGrow
        }

        pp(ns, `Prepare target batch: ${JSON.stringify(prepareTargetBatch, null, 2)}`)
        // ns.exit()

        if (!target.hostname) {
            pp(ns, `How did getServer(${targetHostname}) return ${JSON.stringify(target, null, 2)}`)
        }

        awakenFromPrepareBatchAt = distributeBatch(ns, target, rootedServers, actionStats, availableRam, prepareTargetBatch, true)

        // ONLY RUN ONCE, TESTING
        // pp(ns, `TWO. weakenMin: ${weakenThreadsForMinimum}, grow: ${growThreads}, weakenGrow: ${weakenThreadsForGrow}`, true)
        pp(ns, `PrepareTargetBatch after distribution: ${JSON.stringify(prepareTargetBatch, null, 2)}`)

        // If we have any undistributed threads, we should sleep for the completion of the batch before we start the next one.
        // If not, we can continue on to hacking.
        growThreads = prepareTargetBatch.grow
        weakenThreadsForMinimum = prepareTargetBatch.weaken1
        weakenThreadsForGrow = prepareTargetBatch.weaken2
        if (growThreads > 0 || weakenThreadsForMinimum > 0 || weakenThreadsForGrow > 0) {
            const sleepFor = awakenFromPrepareBatchAt - performance.now()
            pp(ns, `Preparation batch not distributed, sleeping for ${sleepFor}`, true)
            await ns.sleep(sleepFor)
        } else {
            pp(ns, `Preparation batch fully distributed, start hack batch at ${awakenFromPrepareBatchAt}`)
            await ns.sleep(10)
        }

        // Refresh the servers for up-to-date data
        target = ns.getServer(targetHostname)
        if (!target.hostname) {
            pp(ns, `How did getServer(${targetHostname}) return ${JSON.stringify(target, null, 2)}`, true)
        }
        home = ns.getServer('home')

        pp(ns, `End of loop. weakenMin: ${weakenThreadsForMinimum}, grow: ${growThreads}, weakenGrow: ${weakenThreadsForGrow}`)
    }

    // If we're not hacking, don't hack, just load the servers as high as they'll go.
    if (desired === 'xp') {
        let xpBatch = {
            hack: 1,
            weaken1: Number.MAX_SAFE_INTEGER - 1,
        }

        distributeBatch(ns, target, rootedServers, actionStats, availableRam, xpBatch, true, awakenFromPrepareBatchAt)
    } else {
        // Make a fake hack batch, just to simplify the while loop logic.
        let hackBatch = {
            grow: 1,
        }

        let hackPercent = settings().hackPercent

        // If we fail the hack batch, it means we don't have enough ram available.
        // Divide the desired hack percent by 2 and try again.
        while (hackBatch.grow > 0 || hackBatch.hack > 0 || hackBatch.weaken1 > 0 || hackBatch.weaken2 > 0) {
            pp(ns, `Attempting a hack batch with hackPercent ${hackPercent}`)
            const hackResults = hack(ns, target, hackPercent, settings().maxMoneyMultiplier, rootedServers, availableRam, home, awakenFromPrepareBatchAt, actionStats)
            growThreads = hackResults[0]
            weakenThreadsForGrow = hackResults[1]
            hackBatch = hackResults[2]

            // Update this at the end of the loop so the initial hackPercent is correct
            hackPercent = hackPercent / 2

            if (hackPercent <= Number.MIN_VALUE) {
                throw new Error(`Reached hackPercent ${hackPercent} while trying to hack ${target.hostname}`)
            }
        }
    }
}

/** @param {import(".").NS } ns */
function hack(ns, target, hackPercent, maxMoneyMultiplier, rootedServers, availableRam, home, awakenFromPrepareBatchAt, actionStats) {

    // Hack server
    const effectiveMaxMoney = target.moneyMax * maxMoneyMultiplier
    const targetMoneyToRemove = effectiveMaxMoney * hackPercent

    // Because we want to err on the side of fewer threads, we use floor
    // However, that can make us hack for 0 threads if our hacking is too strong.
    let hackThreads = Math.max(1, Math.floor(ns.hackAnalyzeThreads(target.hostname, targetMoneyToRemove)))

    // Err on having stolen more money so we need to grow more
    const moneyStolen = Math.ceil(ns.hackAnalyze(target.hostname) * effectiveMaxMoney) * hackThreads
    const moneyAvailableAfterHack = effectiveMaxMoney - moneyStolen
    const securityIncrease = ns.hackAnalyzeSecurity(hackThreads, target.hostname)

    // Weaken ALWAYS lowers the security level of the target by 0.05
    // https://github.com/danielyxie/bitburner/blob/master/markdown/bitburner.ns.weaken.md
    let weakenThreadsForHack = Math.ceil(securityIncrease / .05)

    // Grow threads run on the home server due to exponential growth
    const moneyTargetAfterGrow = target.moneyMax * settings().maxMoneyMultiplier
    let growThreads = getGrowThreadsRequired(ns, target, moneyAvailableAfterHack, moneyTargetAfterGrow, home.cpuCores)

    // Everything's an approximation, so do one more grow than necessary to make sure we stay on top
    if (hackThreads > 0) {
        growThreads += 1
    }

    pp(ns, `Growing after removing ${targetMoneyToRemove} results in ${growThreads} grow threads`)

    // Source for growthAnalyzeSecurity is currently 'return 2 * CONSTANTS.ServerFortifyAmount * threads;'
    // https://github.com/danielyxie/bitburner/blob/master/src/NetscriptFunctions.ts,
    // except it does a bunch of error correction to only allow the max number of threads etc etc etc
    // We don't care, we just want the number.
    // From https://github.com/danielyxie/bitburner/blob/master/src/Constants.ts, it's 0.002
    const securityIncreaseFromGrow = 2 * 0.002 * growThreads
    // const gAnalyzeResult = ns.growthAnalyzeSecurity(growThreads, target.hostname, 1)

    const weakenThreadsForGrow = Math.ceil(securityIncreaseFromGrow / 0.05) + 1 // Adding one to cover 
    pp(ns, `Weaken threads for ${growThreads} grow threads and ${securityIncreaseFromGrow} secutity increase: ${weakenThreadsForGrow}`)

    let hackBatch = {
        hack: hackThreads,
        weaken1: weakenThreadsForHack,
        grow: growThreads,
        weaken2: weakenThreadsForGrow
    }

    pp(ns, `Hack batch: ${JSON.stringify(hackBatch, null, 2)}`)

    // Loop through the hack batch until we're full.
    let awakenFromHackAt = awakenFromPrepareBatchAt
    awakenFromHackAt = distributeBatch(ns, target, rootedServers, actionStats, availableRam, hackBatch, false, awakenFromHackAt)
    pp(ns, `Hack batch after processing: ${JSON.stringify(hackBatch, null, 2)}`)

    return [growThreads, weakenThreadsForGrow, hackBatch, awakenFromHackAt]
}

/** @param {import(".").NS } ns */
function updateServerData(ns, desired) {
    const serverMap = getItem(settings().keys.serverMap)

    if (!serverMap || serverMap.lastUpdate < new Date().getTime() - settings().mapRefreshInterval) {
        pp(ns, "Server refresh needed, spawning spider", true)
        ns.spawn("spider.js", 1, "formulaHack.js", desired)
        ns.exit()
    }

    serverMap.servers.home.ram = Math.max(0, serverMap.servers.home.ram - settings().homeRamReserved)

    const rootedServers = getRootedServers(ns, serverMap.servers)

    return [serverMap, rootedServers]
}

function getDesiredOptions() {
    return [
        "xp",
        "money",
        "joesguns"
    ]
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    pp(ns, "Starting formulaHack.js", true)

    if (ns.getHostname() !== 'home') {
        throw new Error('Must be run from home')
    }

    [
        "getServerUsedRam",
        "getServerSecurityLevel",
        "getServerMinSecurityLevel",
        "scp",
    ].forEach(logName => ns.disableLog(logName))

    const desiredOptions = getDesiredOptions()

    let desired = "money"
    if (ns.args.length > 0 && desiredOptions.includes(ns.args[0])) {
        desired = ns.args[0]
    }
    pp(ns, `Desired: ${desired}`, true)

    let numTargets = 1
    if (ns.args.length > 1) {
        numTargets = ns.args[1]
    }
    pp(ns, `Number of targets: ${numTargets}`)

    const actionStats = {
        grow: {
            script: 'grow.batch.js',
        },
        weaken: {
            script: 'weaken.batch.js',
        },
        hack: {
            script: 'hack.batch.js',
        }
    }

    // Add ram cost for each action
    Object.keys(actionStats).forEach(action => {
        actionStats[action].ram = ns.getScriptRam(actionStats[action].script)
    })

    while (true) {
        const serverExtraData = {}

        const serverData = updateServerData(ns, desired)
        const serverMap = serverData[0]
        const rootedServers = serverData[1]

        // Get the target server
        let targets = ['joesguns']
        if (desired === 'money' && ns.getPlayer().skills.hacking > ns.getServer('avmnite-02h').requiredHackingSkill) {
            const targetServers = findWeightedTargetServers(ns, rootedServers, serverMap.servers, serverExtraData)

            // Set the targets to the top N servers
            targets = []
            for (let i = 0; i < numTargets; i++) {
                targets.push(targetServers.shift())
            }
        }

        // TODO TEMP
        // bestTarget = 'foodnstuff'
        let target = targets.shift()
        while (target) {
            await prepareAndHackTarget(ns, rootedServers, target, actionStats, desired)
            target = targets.shift()
        }

        // while (hackBatch.hack > 0 || hackBatch.weaken1 > 0 || hackBatch.grow > 0 || hackBatch.weaken2 > 0) {
        //     const sleepTime = Math.max(100, awakenFromHackAt - performance.now())
        //     await ns.sleep(sleepTime)
        // }

        await ns.sleep(200)

        // const sleepTime = Math.max(100, awakenFromHackAt - performance.now())
        // const sleepTime = 100
        // await ns.sleep(sleepTime)
    }
}

export function autocomplete(data, args) {
    return getDesiredOptions();
}