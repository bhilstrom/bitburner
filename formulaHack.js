import { numberWithCommas, settings, getItem, pp } from './common.js'

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
            return 1
        } else if (a === 'home') {
            return -1
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
    if (ns.fileExists('Formulas.exe')) {
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

function setBatchDelays(ns, batch, actionStats) {
    // Set up the delays for the actions in the batch
    // 1. Find the first longest-running script
    // 2. Count up from there, make every script finish later than the one before it
    // 3. Count down from there, make every script finish earlier than the one before it
    let firstLongestIndex = 0
    for (let i = 0; i < batch.length; i++) {
        if (actionStats[batch[i].action].time > actionStats[batch[firstLongestIndex].action].time) {
            firstLongestIndex = i
        }
    }

    const longestActionTime = actionStats[batch[firstLongestIndex].action].time
    batch[firstLongestIndex].delay = 0

    // pp(ns, `First longest index is ${firstLongestIndex}`)
    const bufferMs = 200
    for (let i = firstLongestIndex + 1; i < batch.length; i++) {
        const bufferDelay = (i - firstLongestIndex) * bufferMs
        batch[i].delay = longestActionTime - actionStats[batch[i].action].time + bufferDelay
    }
    for (let i = firstLongestIndex - 1; i >= 0; i--) {
        const bufferDelay = (firstLongestIndex - i) * bufferMs
        batch[i].delay = longestActionTime - actionStats[batch[i].action].time - bufferDelay
    }
}

/**
 * @param {import(".").Server} server
 */
function getAvailableThreads(server, ramNeeded) {
    return Math.floor((server.maxRam - server.ramUsed) / ramNeeded)
}

/**
 * @param {import(".").NS } ns
 */
function getAvailableRam(ns, rootedServers) {

    const ramMap = {}
    rootedServers.forEach(hostname => {
        const server = ns.getServer(hostname)
        ramMap[hostname] = server.maxRam - server.ramUsed
    })
    return ramMap
}

/**
 * 
 * @param {import(".").NS } ns
 * @param {import(".").Server} target
 * @param {import(".").Server} home
 */
function distributeBatch(ns, target, home, rootedServers, actionStats, availableRam, batch) {

    const bufferMs = 40
    let currentTime = performance.now()
    let nextLanding = currentTime + actionStats.weaken.time + (bufferMs * 4)
    let batchToExecute = []

    for (let hostname of rootedServers) {
        if (batch.hack <= 0) {
            break
        }

        // Hacks must all be executed on the same server, because they're exponential
        const ramRequired = batch.hack * actionStats.hack.ram
        if (availableRam[hostname] < ramRequired) {
            continue
        }

        batchToExecute.push({
            attacker: hostname,
            action: 'hack',
            threads: batch.hack,
            landing: nextLanding
        })

        availableRam[hostname] -= threadsToExecute * actionStats.hack.ram
        batch.hack = 0
    }

    // Growth should be executed on 'home'.
    // It's exponential, and home gets weird bonuses to grow sometimes.
    const growThreadsAvailable = Math.floor(availableRam.home / actionStats.grow.ram)
    const growTheadsToExecute = Math.min(growThreadsAvailable, batch.grow)
    if (batch.grow > 0 && growTheadsToExecute > 0) {
        batchToExecute.push({
            attacker: 'home',
            action: 'grow',
            threads: growTheadsToExecute,
            landing: nextLanding + (bufferMs * 2) // Grow happens after hack and first weaken
        })

        availableRam.home -= (growTheadsToExecute * actionStats.grow.ram)
        batch.grow = 0
    }

    // Weakens execute on any server
    for (let hostname of rootedServers) {
        if (batch.weaken1 > 0) {
            batch.weaken1 = distributeWeaken(ns, batch.weaken1, hostname, availableRam, actionStats, nextLanding + bufferMs, batchToExecute)
        }

        if (batch.weaken2 > 0) {
            batch.weaken2 = distributeWeaken(ns, batch.weaken2, hostname, availableRam, actionStats, nextLanding + (bufferMs * 3), batchToExecute)
        }
    }

    pp(ns, `Batch: ${JSON.stringify(batchToExecute, null, 2)}`, true)

    // Actually distribute the commands
    for (let cmd of batchToExecute) {
        pp(ns, `Executing against ${target.hostname}: ${JSON.stringify(cmd, null, 2)}`, true)
        ns.exec(actionStats[cmd.action].script, cmd.attacker, cmd.threads, target.hostname, cmd.landing)
    }
}

/**
 * @param {import(".").NS } ns
 */
function distributeWeaken(ns, threads, hostname, availableRam, actionStats, landing, batchToExecute) {

    let threadsAvailable = Math.floor(availableRam[hostname] / actionStats.weaken.ram)

    let threadsToExecute = Math.min(threads, threadsAvailable)
    batchToExecute.push({
        attacker: hostname,
        action: 'weaken',
        threads: threadsToExecute,
        landing: landing
    })

    availableRam[hostname] -= (threadsToExecute * actionStats.weaken.ram)

    pp(ns, `Distributed ${threadsToExecute} threads, ${threads - threadsToExecute} remaining`)
    return threads - threadsToExecute
}

/**
 * @param {import(".").NS } ns
 * @param {import(".").Server} home
 * @param {import(".").Server} target
 * @param {import(".").Player} player
 */
function getGrowThreadsRequired(ns, target, cores = 1) {
    const desiredMoney = target.moneyMax * settings().maxMoneyMultiplayer
    const growthAmount = desiredMoney - target.moneyAvailable

    if (growthAmount <= 0) {
        return 0
    }

    return Math.ceil(ns.growthAnalyze(target.hostname, desiredMoney / target.moneyAvailable, cores))
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

    const desiredOptions = [
        "xp",
        "money"
    ]

    let desired = "money"
    if (ns.args.length > 0 && desiredOptions.includes(ns.args[0])) {
        desired = ns.args[0]
    }
    pp(ns, `Desired: ${desired}`, true)

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

    const maxRamRequired = Math.max(Object.keys(actionStats).map(stat => actionStats[stat].ram))

    // while (true) {
    const serverExtraData = {}

    const serverMap = getItem(settings().keys.serverMap)

    if (!serverMap || serverMap.lastUpdate < new Date().getTime() - settings().mapRefreshInterval) {
        pp(ns, "Server refresh needed, spawning spider", true)
        ns.spawn("spider.js", 1, "formulaHack.js")
        ns.exit()
        return
    }

    serverMap.servers.home.ram = Math.max(0, serverMap.servers.home.ram - settings().homeRamReserved)

    const rootedServers = getRootedServers(ns, serverMap.servers)

    // Get the target server
    let bestTarget = 'joesguns'
    // if (desired === 'money' && ns.getPlayer().skills.hacking > 400) {
    //     const targetServers = findWeightedTargetServers(ns, rootedServers, serverMap.servers, serverExtraData)
    //     bestTarget = targetServers.shift()
    // }

    // TODO TEMP
    bestTarget = 'zb-institute'

    const target = ns.getServer(bestTarget)

    const home = ns.getServer('home')
    const player = ns.getPlayer()

    // Get the time it would take to run each script against the server
    const actionTimes = getActionTimes(ns, target, player)
    pp(ns, `${JSON.stringify(actionTimes, null, 2)}`, true)
    Object.keys(actionTimes).forEach(action => {
        actionStats[action].time = actionTimes[action]
    })

    // Prepare server
    // Set so we enter the while loop and get the REAL values
    let weakenThreadsForMinimum = 1
    let growThreads = 0
    let weakenThreadsForGrow = 0
    pp(ns, `ZERO. weakenMin: ${weakenThreadsForMinimum}, grow: ${growThreads}, weakenGrow: ${weakenThreadsForGrow}`, true)
    while (weakenThreadsForMinimum > 0 || growThreads > 0 || weakenThreadsForGrow > 0) {
        await ns.sleep(100)
        // pp(ns, `ONE. weakenMin: ${weakenThreadsForMinimum}, grow: ${growThreads}, weakenGrow: ${weakenThreadsForGrow}`, true)
        pp(ns, `ONE`, true)
        // Weaken ALWAYS lowers the security level of the target by 0.05
        // https://github.com/danielyxie/bitburner/blob/master/markdown/bitburner.ns.weaken.md
        weakenThreadsForMinimum = Math.ceil((target.hackDifficulty - target.minDifficulty) / .05)

        // All grow threads run on the home server due to exponential growth
        growThreads = getGrowThreadsRequired(ns, target, home.cpuCores)

        // This method optionally takes 'cores', but ideally weaken is distributed to machines other than 'home'
        weakenThreadsForGrow = Math.ceil(ns.growthAnalyzeSecurity(growThreads, target.hostname, 1))

        let prepareTargetBatch = {
            hack: 0,
            weaken1: weakenThreadsForMinimum,
            grow: growThreads,
            weaken2: weakenThreadsForGrow
        }

        let availableRam = getAvailableRam(ns, rootedServers)
        distributeBatch(ns, target, home, rootedServers, actionStats, availableRam, prepareTargetBatch)

        // ONLY RUN ONCE, TESTING
        weakenThreadsForGrow = -1
        growThreads = -1
        weakenThreadsForMinimum = -1
        pp(ns, `TWO. weakenMin: ${weakenThreadsForMinimum}, grow: ${growThreads}, weakenGrow: ${weakenThreadsForGrow}`, true)

        await ns.sleep(100)
    }

    // Hack-loop server

    // const batch = [
    //     {
    //         action: 'hack',
    //     },
    //     {
    //         action: 'weaken',
    //     },
    //     {
    //         action: 'grow'
    //     },
    //     {
    //         action: 'weaken'
    //     }
    // ]
    // const batchRamCost = batch.reduce((acc, current) => acc + actionStats[current.action].ram)
    // setBatchDelays(ns, batch, actionStats)

    // pp(ns, `Batch: ${JSON.stringify(batch, null, 2)}`, true)

    // rootedServers.forEach(serverName => {
    //     const availableRam = serverMap.servers[serverName].ram - ns.getServerUsedRam(serverName)
    //     const numberOfBatches = Math.floor(availableRam / batchRamCost)

    //     batch.forEach(batchItem => {
    //         ns.exec(actionStats[batchItem.action].script, targetServer.hostname, numberOfBatches, )
    //     })
    // })

    //     await ns.sleep(100)
    // }
}