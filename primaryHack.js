import { localeHHMMSS, settings, getItem, pp } from './common.js'

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

    rootServers.sort((a, b) => servers[a].ram - servers[b].ram)
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

function weakenCyclesForGrow(growCycles) {
    return Math.max(0, Math.ceil(growCycles * (settings().changes.grow / settings().changes.weaken)))
}

function weakenCyclesForHack(hackCycles) {
    return Math.max(0, Math.ceil(hackCycles * (settings().changes.hack / settings().changes.weaken)))
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
function getWeakenThreadsForMinimum(ns, host) {

    const currentSecurity = ns.getServerSecurityLevel(host)
    const minSecurity = ns.getServerMinSecurityLevel(host)

    let threads = 0
    let newSecurity = currentSecurity

    // We need this to enable backtracking
    let oldSecurity = newSecurity

    // Double estimated threads each time
    while (newSecurity > minSecurity) {
        threads = Math.max(1, threads * 2)
        oldSecurity = newSecurity
        newSecurity = currentSecurity - ns.weakenAnalyze(threads)
    }

    // Threads was increased above threshold, put it back
    threads = Math.floor(threads / 2)
    newSecurity = oldSecurity

    // Count up from here
    while (newSecurity > minSecurity) {
        threads += 1
        newSecurity = currentSecurity - ns.weakenAnalyze(threads)
    }

    threads = Math.max(0, threads - 1)
    pp(ns, `${host} needs ${threads} weakens to go from ${currentSecurity} to ${minSecurity}`)
    return threads
}

/** @param {import(".").NS } ns */
function getSetupBatch(ns, host) {

    const batch = []
    const weakenThreadsForMinimum = getWeakenThreadsForMinimum(ns, host)
    if (weakenThreadsForMinimum > 0) {
        batch.push({
            threads: weakenThreadsForMinimum,
            actions: ['weaken']
        })
    }

    const maxMoney = Math.ceil(ns.getServerMaxMoney(host) * settings().maxMoneyMultiplayer)
    const currentMoney = Math.ceil(ns.getServerMoneyAvailable(host))

    // Take max of 0 and (max - current) in case we have more money available than the target
    const moneyGrowthWanted = Math.max(0, maxMoney - currentMoney)
    // pp(ns, `${host} has ${currentMoney} curret money and ${maxMoney} target max money. Growth: ${moneyGrowthWanted}`)
    if (moneyGrowthWanted > 0) {
        const growthsNeeded = Math.ceil(ns.growthAnalyze(host, moneyGrowthWanted))
        pp(ns, `${host} needs ${growthsNeeded} growths to go from ${currentMoney} to ${maxMoney}`)

        batch.push(
            {
                threads: growthsNeeded,
                actions: ['grow', 'weaken']
            }
        )
    } else {
        pp(ns, `${host} is already at max money. No growth needed.`)
    }

    // pp(ns, `Setup batch: ${JSON.stringify(batch, null, 2)}`)

    return batch
}

/** @param {import(".").NS } ns */
function getHackBatch(ns, host) {
    return [
        {
            threads: 1,
            actions: ['grow', 'weaken']
        },
        {
            threads: 1,
            actions: ['hack', 'weaken']
        }
    ]
}

/** @param {import(".").NS } ns */
async function processBatch(ns, fullBatch, rootedServers, actionStats, serverMap, target) {
    pp(ns, `### Processing ${fullBatch.length} batch(es)`)

    // pp(ns, `actionStats: ${JSON.stringify(actionStats, null, 2)}`)

    // Distribute batches across rooted servers
    let longestRunningScript = 0

    for (let batchIndex = 0; batchIndex < fullBatch.length; batchIndex++) {

        const batch = fullBatch[batchIndex]

        pp(ns, `Batch: ${JSON.stringify(batch, null, 2)}`)

        const maxActionTime = Math.max.apply(Math, batch.actions.map(action => actionStats[action].time))
        pp(ns, `Longest running script in this batch is ${maxActionTime}`)

        const batchRamCost = batch.actions.reduce((accumulator, action) => {
            return accumulator + actionStats[action].ram
        }, 0)
        // pp(ns, `RAM usage for one batch is ${batchRamCost}`)

        /* TODO:
        - Get max script time in this batch item
        - Determine amount of ram required for a full batch run (all scripts in batch item)
        - Divide server ram by amount of ram for a batch = # of threads this server can run
        - Get script run lengths, calculate delays so the scripts finish in the order they exist in the batch actions
        - Execute # of batches on server
        - Repeat for next server (skip first 2, those are constant)
        -
        - When moving to the next batch item, sleep for the max batch item runtime so we know the batches happened in order
        */

        for (let actionIndex = 0; actionIndex < batch.actions.length; actionIndex++) {
            const action = batch.actions[actionIndex]

            let actionThreads = batch.threads

            while (actionThreads > 0) {
                rootedServers
                    .map(host => serverMap.servers[host])
                    .every(server => {
                        pp(ns, `Processing ${action} action on ${server.host}`)

                        // pp(ns, `Server: ${JSON.stringify(server, null, 2)}`)

                        // Get number of threads to spawn on the current server
                        const availableRam = server.ram - ns.getServerUsedRam(server.host)
                        const availableThreads = Math.floor(availableRam / actionStats[action].ram)
                        const numThreads = Math.min(availableThreads, actionThreads)
                        pp(ns, `RAM available: ${availableRam}. Threads: available ${availableThreads}, desired ${actionThreads}, will execute ${numThreads}`)

                        if (numThreads > 0) {
                            // pp(ns, `batchItem: ${JSON.stringify(batchItem, null, 2)}`)
                            // pp(ns, `actionStats: ${JSON.stringify(actionStats, null, 2)}`)

                            // Add actionIndex to the script delay so they will finish in action declaration order
                            const scriptDelay = Math.ceil(maxActionTime - actionStats[action].time) + actionIndex

                            longestRunningScript = Math.max(longestRunningScript, actionStats[action].time)

                            pp(ns, `Assigning ${server.host} to ${action} ${target} with ${numThreads} threads and ${scriptDelay} delay`)
                            ns.exec(actionStats[action].script, server.host, numThreads, target, numThreads, scriptDelay, createUUID())
                        }

                        // Update number of desired threads remaining for the current action
                        actionThreads -= numThreads
                        pp(ns, `Action threads remaining: ${actionThreads}`)
                        // await ns.sleep(100)

                        return actionThreads > 0 // If falsy, will stop looping over rootedServers
                    })

                pp(ns, `Sleep check`)
                await ns.sleep(100)

                // There are no running servers left that can process the actions.
                // Sleep for the length of the action, then check the same action again.
                if (actionThreads > 0) {
                    const sleepTime = actionStats[action].time + 10
                    pp(ns, `Ran out of servers, ${actionThreads} ${action} actions remain. Sleeping for ${sleepTime}`)
                    await ns.sleep(sleepTime)
                }
            }
        }

        // // We have now been through the entire batch and run as much as we can on the servers.
        // // If anything is left, we need to wait for the longest running script to complete.
        // // const itemWithMore = batch.find(batchItem => batchItem.threads > 0)
        // if (batch.threads > 0) {
        //     const sleepTime = Math.ceil(longestRunningScript + 100)
        //     pp(ns, `Sleeping for ${(sleepTime / 1000 / 60).toFixed(2)} minutes before starting batch with ${JSON.stringify(batch.actions, null, 2)} for ${batch.threads} threads`)
        //     await ns.sleep(sleepTime)
        // } else {
        //     // Nothing is left to process in the current batch, so we can move to the next one.
        //     fullBatch.shift()
        // }

        pp(ns, `### Batch ${batchIndex} complete, ${fullBatch.length - batchIndex - 1} batches remaining`)
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
    pp(ns, "Starting primaryHack.js")

    if (ns.getHostname() !== 'home') {
        throw new Exception('Must be run from home')
    }

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
            pp(ns, "Server refresh needed, spawning spider")
            ns.spawn("spider.js", 1, "primaryHack.js")
            ns.exit()
            return
        }

        serverMap.servers.home.ram = Math.max(0, serverMap.servers.home.ram - settings().homeRamReserved)

        const rootedServers = getRootedServers(ns, serverMap.servers)
        // pp(ns, `RootedServers: ${JSON.stringify(rootedServers, null, 2)}`)

        const targetServers = findWeightedTargetServers(ns, rootedServers, serverMap.servers, serverExtraData)
        const bestTarget = targetServers.shift()

        // Set the amount of time each action will take to complete for the current machine
        Object.keys(actionStats).forEach(action => {
            actionStats[action].time = getTimeForAction(ns, bestTarget, action)
        })

        const setupBatch = getSetupBatch(ns, bestTarget)
        await processBatch(ns, setupBatch, rootedServers, actionStats, serverMap, bestTarget)

        const hackBatch = getHackBatch(ns, bestTarget)
        await processBatch(ns, hackBatch, rootedServers, actionStats, serverMap, bestTarget)

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