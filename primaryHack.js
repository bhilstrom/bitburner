import { settings, getItem, pp } from './common.js'

const hackingScripts = ['hack.js', 'grow.js', 'weaken.js', 'common.js']

/** @param {import(".").NS } ns */
function getRootedServers(ns, servers) {

    const rootServers = Object.keys(servers)
        .filter((hostname) => ns.serverExists(hostname))
        .filter((hostname) => ns.hasRootAccess(hostname))
        .filter((hostname) => servers[hostname].ram >= 2)

    // Copy hacking scripts to rooted servers
    rootServers
        .filter(hostname => hostname !== "home")
        .forEach(hostname => ns.scp(hackingScripts, hostname))

    // Send scripts to biggest servers first
    rootServers.sort((a, b) => servers[b].ram - servers[a].ram)
    return rootServers
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

function numberWithCommas(x) {
    return x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ',')
}

function convertMSToHHMMSS(ms = 0) {
    if (ms <= 0) {
        return '00:00:00'
    }

    if (!ms) {
        ms = new Date().getTime()
    }

    return new Date(ms).toISOString().substr(11, 8)
}

function createUUID() {
    var dt = new Date().getTime()
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (dt + Math.random() * 16) % 16 | 0
        dt = Math.floor(dt / 16)
        return (c == 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
    return uuid
}

/** @param {import(".").NS } ns */
function getCores(ns, serverMap) {
    // pp(ns, `serverMap: ${JSON.stringify(serverMap, null, 2)}`, true)
    return serverMap.servers["home"].cores
}

/** @param {import(".").NS } ns */
function getWeakenThreadsForMinimum(ns, host, serverMap) {

    const currentSecurity = ns.getServerSecurityLevel(host)
    const minSecurity = ns.getServerMinSecurityLevel(host)

    let threads = 0
    let newSecurity = currentSecurity

    // We need this to enable backtracking
    let oldSecurity = newSecurity

    const cores = getCores(ns, serverMap)

    // Double estimated threads each time
    while (newSecurity > minSecurity) {
        threads = Math.max(1, threads * 2)
        oldSecurity = newSecurity

        newSecurity = currentSecurity - ns.weakenAnalyze(threads, cores)
    }

    // Threads was increased above threshold, put it back
    threads = Math.floor(threads / 2)
    newSecurity = oldSecurity

    // Count up from here
    while (newSecurity > minSecurity) {
        threads += 1
        newSecurity = currentSecurity - ns.weakenAnalyze(threads, cores)
    }

    threads = Math.max(0, threads - 1)
    pp(ns, `${host} needs ${threads} weakens to go from ${currentSecurity} to ${minSecurity}`)
    return threads
}

/** @param {import(".").NS } ns */
function getSetupBatch(ns, host, desired, serverMap) {

    const batch = []
    let weakenThreadsForMinimum = getWeakenThreadsForMinimum(ns, host, serverMap)
    // if (desired === 'xp') {
    //     weakenThreadsForMinimum = 5000
    // } else {
    //     weakenThreadsForMinimum = getWeakenThreadsForMinimum(ns, host)
    // }
    if (weakenThreadsForMinimum > 0) {
        batch.push({
            threads: weakenThreadsForMinimum,
            actions: [
                {
                    name: 'weaken'
                }
            ]
        })
    }

    let moneyGrowthWanted = 0
    if (desired === 'xp') {
        pp(ns, `Only targeting ${host} for ${desired}, no money growth desired.`)
    } else {
        const maxMoney = Math.ceil(ns.getServerMaxMoney(host) * settings().maxMoneyMultiplayer)
        const currentMoney = Math.ceil(ns.getServerMoneyAvailable(host))

        // Take max of 0 and (max - current) in case we have more money available than the target
        moneyGrowthWanted = Math.max(0, maxMoney - currentMoney)
        // pp(ns, `${host} has ${currentMoney} curret money and ${maxMoney} target max money. Growth: ${moneyGrowthWanted}`)
        if (moneyGrowthWanted > 0) {
            
            const cores = getCores(ns, serverMap)

            // growthAnalyze takes a growth FACTOR, not a growth amount
            const growthFactorWanted = maxMoney / currentMoney
            const growthsNeeded = Math.ceil(ns.growthAnalyze(host, growthFactorWanted, cores))
            pp(ns, `${host} needs ${growthsNeeded} growths to go from ${numberWithCommas(currentMoney)} to ${numberWithCommas(maxMoney)}`, true)

            batch.push(
                {
                    threads: growthsNeeded,
                    actions: [
                        {
                            name: 'grow'
                        },
                        {
                            name: 'weaken'
                        }
                    ]
                }
            )
        } else {
            pp(ns, `${host} is already at max money. No growth needed.`)
        }
    }

    // pp(ns, `Setup batch: ${JSON.stringify(batch, null, 2)}`)

    return batch
}

/** @param {import(".").NS } ns */
function getHackBatch(ns, host, desired) {

    let actions = ['hack', 'weaken']

    if (desired !== 'xp') {
        actions = actions.concat(['grow', 'weaken', 'grow', 'weaken'])
    }

    return [
        {
            threads: 1,
            actions: actions.map(action => {
                return {
                    name: action
                }
            })
        }
    ]
}

/** @param {import(".").NS } ns */
function getFreeRam(ns, server) {
    let freeRam = server.ram - ns.getServerUsedRam(server.host)

    // Keep ram available on 'home'
    if (server.host === 'home') {
        freeRam -= settings().homeRamReserved
    }

    return freeRam
}

/** @param {import(".").NS } ns */
function getMaxThreadsAvailable(ns, server, action, actionStats) {
    const freeRam = getFreeRam(ns, server)
    return Math.floor(freeRam / actionStats[action].ram)
}

/** @param {import(".").NS } ns */
function canRunAction(ns, server, action, actionStats) {
    if (!server) {
        return false
    }

    const freeRam = getFreeRam(ns, server)
    return freeRam > actionStats[action].ram
}

/** @param {import(".").NS } ns */
function findServerForScript(ns, rootedServers, serverMap, action, actionStats) {
    return rootedServers
        .map(host => serverMap.servers[host])
        .find(server => canRunAction(ns, server, action, actionStats))
}

/** @param {import(".").NS } ns */
async function processBatch(ns, fullBatch, rootedServers, actionStats, serverMap, target, desired) {
    // pp(ns, `### Processing ${fullBatch.length} batch(es)`)

    // pp(ns, `actionStats: ${JSON.stringify(actionStats, null, 2)}`)

    // Distribute batches across rooted servers
    for (let batchIndex = 0; batchIndex < fullBatch.length; batchIndex++) {

        const batch = fullBatch[batchIndex]

        // pp(ns, `Batch: ${JSON.stringify(batch, null, 2)}`)

        // Set up the delays for the actions in the batch
        // 1. Find the first longest-running script
        // 2. Count up from there, make every script finish later than the one before it
        // 3. Count down from there, make every script finish earlier than the one before it
        let firstLongestIndex = 0
        for (let i = 0; i < batch.actions.length; i++) {
            if (actionStats[batch.actions[i].name].time > actionStats[batch.actions[firstLongestIndex].name].time) {
                firstLongestIndex = i
            }
        }

        const longestActionTime = actionStats[batch.actions[firstLongestIndex].name].time
        batch.actions[firstLongestIndex].delay = 0

        // pp(ns, `First longest index is ${firstLongestIndex}`)
        const bufferMs = 100
        for (let i = firstLongestIndex + 1; i < batch.actions.length; i++) {
            const bufferDelay = (i - firstLongestIndex) * bufferMs
            batch.actions[i].delay = longestActionTime - actionStats[batch.actions[i].name].time + bufferDelay
        }
        for (let i = firstLongestIndex - 1; i >= 0; i--) {
            const bufferDelay = (firstLongestIndex - i) * bufferMs
            batch.actions[i].delay = longestActionTime - actionStats[batch.actions[i].name].time - bufferDelay
        }

        // pp(ns, `Batch: ${JSON.stringify(batch, null, 2)}`)

        // const maxActionTime = Math.max.apply(Math, batch.actions.map(action => actionStats[action.name].time))
        // pp(ns, `Longest running script in this batch is ${maxActionTime}`)

        // const minActionTime = Math.min.apply(Math, batch.actions.map(action => actionStats[action.name].time))
        // pp(ns, `Shortest running script in this batch is ${minActionTime}`)

        // const batchRamCost = batch.actions.reduce((accumulator, action) => {
        //     return accumulator + actionStats[action].ram
        // }, 0)
        // pp(ns, `RAM usage for one batch is ${batchRamCost}`)

        for (let threadCount = 0; threadCount < batch.threads; threadCount++) {

            let currentServer = null
            let ranOutOfServers = false
            // let previousActionName = null
            for (let actionIndex = 0; actionIndex < batch.actions.length; actionIndex++) {
                const action = batch.actions[actionIndex]

                // Set script delay so the scripts finish in order
                // let scriptDelay = 0
                // if (previousActionName) {
                //     scriptDelay = Math.max(0, actionStats[previousActionName].time - actionStats[action.name].time + 2)
                //     // pp(ns, `${previousAction} will take ${actionStats[previousAction].time}, ${action} will take ${actionStats[action].time}, delaying for ${scriptDelay}`)
                // }

                // const scriptDelay = Math.ceil(maxActionTime - actionStats[action].time) + (actionIndex * 5)
                // longestRunningScript = Math.max(longestRunningScript, actionStats[action].time)

                if (!canRunAction(ns, currentServer, action.name, actionStats)) {
                    // pp(ns, `Looking for server to run ${action} against ${target}`)
                    currentServer = findServerForScript(ns, rootedServers, serverMap, action.name, actionStats)
                }

                while (!currentServer) {
                    const lastBatchItem = batch.actions[batch.actions.length - 1]
                    const sleepTime = lastBatchItem.delay + actionStats[lastBatchItem.name].time + bufferMs
                    ranOutOfServers = true
                    pp(ns, `All servers full, ${batch.threads - threadCount} threads remaining. Sleeping for ${sleepTime / 1000 / 60} minutes`, true)
                    await ns.sleep(sleepTime)
                    pp(ns, `Resuming batch: ${JSON.stringify(batch.actions, null, 2)}`)
                    // pp(ns, `Looking for server to run ${action} against ${target}`)
                    currentServer = findServerForScript(ns, rootedServers, serverMap, action.name, actionStats)
                }

                let desiredThreads = 1
                if (desired === 'xp') {
                    desiredThreads = getMaxThreadsAvailable(ns, currentServer, action.name, actionStats)
                    // pp(ns, `Found ${desiredThreads} threads available on ${currentServer.host}`)
                }

                // currentServer can run action
                // pp(ns, `Assigning ${currentServer.host} to ${action} ${target} with ${scriptDelay} delay`)
                ns.exec(actionStats[action.name].script, currentServer.host, desiredThreads, target, desiredThreads, action.delay, createUUID())

                // Sleep so the loop doesn't crash us
                await ns.sleep(1)

                // previousAction = action
            }

            // If we ran out of servers, stop the batch so we can recalculate the correct number of threads remaining. We may have leveled up!
            if (ranOutOfServers) {
                break
            }
        }

        // pp(ns, `### Batch ${batchIndex} complete, ${fullBatch.length - batchIndex - 1} batches remaining`)
    }

    // pp(ns, "Sleeping inside fullBatch loop")
    // await ns.sleep(3000)
}

/** @param {import(".").NS } ns */
function getTimeForAction(ns, host, action) {
    if (action === 'weaken') {
        return ns.getWeakenTime(host)
    }

    if (action === 'grow') {
        return ns.getGrowTime(host)
    }

    if (action === 'hack') {
        return ns.getHackTime(host)
    }
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    pp(ns, "Starting primaryHack.js", true)

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
        "money",
        "early"
    ]

    let desired = "money"
    if (ns.args.length > 0 && desiredOptions.includes(ns.args[0])) {
        desired = ns.args[0]
    }
    pp(ns, `Desired: ${desired}`, true)

    const actionStats = {
        grow: {
            script: 'grow.js',
        },
        weaken: {
            script: 'weaken.js',
        },
        hack: {
            script: 'hack.js',
        }
    }

    // Add ram cost for each action
    Object.keys(actionStats).forEach(action => {
        actionStats[action].ram = ns.getScriptRam(actionStats[action].script)
    })

    const maxRamRequired = Math.max(Object.keys(actionStats).map(stat => actionStats[stat].ram))

    while (true) {
        const serverExtraData = {}

        const serverMap = getItem(settings().keys.serverMap)

        if (!serverMap || serverMap.lastUpdate < new Date().getTime() - settings().mapRefreshInterval) {
            pp(ns, "Server refresh needed, spawning spider", true)
            ns.spawn("spider.js", 1, "primaryHack.js")
            ns.exit()
            return
        }

        serverMap.servers.home.ram = Math.max(0, serverMap.servers.home.ram - settings().homeRamReserved)

        const rootedServers = getRootedServers(ns, serverMap.servers)
        // pp(ns, `RootedServers: ${JSON.stringify(rootedServers, null, 2)}`)

        let bestTarget = 'joesguns'
        if (desired === 'early') {
            bestTarget = 'n00dles'
        } else if (desired !== 'money' && ns.getPlayer().skills.hacking > 200) {
            const targetServers = findWeightedTargetServers(ns, rootedServers, serverMap.servers, serverExtraData)
            bestTarget = targetServers.shift()
        }

        // Set the amount of time each action will take to complete for the current machine
        Object.keys(actionStats).forEach(action => {
            actionStats[action].time = getTimeForAction(ns, bestTarget, action)
        })

        const setupBatch = getSetupBatch(ns, bestTarget, desired, serverMap)
        pp(ns, `Processing setup batch...`)
        await processBatch(ns, setupBatch, rootedServers, actionStats, serverMap, bestTarget, desired)

        const hackBatch = getHackBatch(ns, bestTarget, desired)
        pp(ns, `Processing hack batch...`)
        await processBatch(ns, hackBatch, rootedServers, actionStats, serverMap, bestTarget, desired)

        // If all of our rooted servers are full, sleep.
        // if (!rootedServers.some(rootedServer => (serverMap.servers[rootedServer].ram - ns.getServerUsedRam(rootedServer)) > maxRamRequired)) {
        //     const maxExecuteTime = Math.max.apply(Math, Object.keys(actionStats).map(stat => actionStats[stat].time))
        //     const sleepTime = Math.ceil(maxExecuteTime + 1000)
        //     pp(ns, `No more rooted servers available, sleeping for ${sleepTime}`)
        //     await ns.sleep(sleepTime)
        // }

        pp(ns, "Running through again after pause...")
        await ns.sleep(100)
    }
}