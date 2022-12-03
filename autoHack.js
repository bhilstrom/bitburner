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
    pp(ns, `Weighted servers: ${JSON.stringify(weightedServers, null, 2)}`)

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
export async function main(ns) {
    pp(ns, "Starting autoHack.js")

    if (ns.getHostname() !== 'home') {
        throw new Exception('Must be run from home')
    }

    while (true) {
        const serverExtraData = {}

        const serverMap = getItem(settings().keys.serverMap)

        if (!serverMap || serverMap.lastUpdate < new Date().getTime() - settings().mapRefreshInterval) {
            pp(ns, "Server refresh needed, spawning spider")
            ns.spawn("spider.js", 1, "autoHack.js")
            ns.exit()
            return
        }

        serverMap.servers.home.ram = Math.max(0, serverMap.servers.home.ram - settings().homeRamReserved)

        const rootedServers = getRootedServers(ns, serverMap.servers)
        pp(ns, `RootedServers: ${JSON.stringify(rootedServers, null, 2)}`)

        const targetServers = findWeightedTargetServers(ns, rootedServers, serverMap.servers, serverExtraData)

        const bestTarget = targetServers.shift()
        const hackTime = ns.getHackTime(bestTarget) * 1000
        const growTime = ns.getGrowTime(bestTarget) * 1000
        const weakenTime = ns.getWeakenTime(bestTarget) * 1000

        const growDelay = Math.max(0, weakenTime - growTime - 15 * 1000)
        const hackDelay = Math.max(0, growTime + growDelay - hackTime - 15 * 1000)

        const securityLevel = ns.getServerSecurityLevel(bestTarget)
        const money = ns.getServerMoneyAvailable(bestTarget)

        const serverMapTarget = serverMap.servers[bestTarget]

        let action = 'weaken'
        if (securityLevel > serverMapTarget.minSecurityLevel + settings().minSecurityLevelOffset) {
            action = 'weaken'
        } else if (money < serverMapTarget.maxMoney * settings().maxMoneyMultiplayer) {
            action = 'grow'
        } else {
            action = 'hack'
        }

        let hackCycles = 0
        let growCycles = 0

        rootedServers
            .map(host => serverMap.servers[host])
            .forEach(server => {
                hackCycles += Math.floor(server.ram / 1.7)
                growCycles += Math.floor(server.ram / 1.75)
            })

        let weakenCycles = growCycles

        pp(ns, `Selected ${bestTarget} to ${action}. Will wake up around ${localeHHMMSS(new Date().getTime() + weakenTime + 300)}`)
        pp(ns, `Stock values: baseSecurity ${serverMapTarget.baseSecurityLevel}; minSecurity ${serverMapTarget.minSecurityLevel}; maxMoney: $${numberWithCommas(parseInt(serverMapTarget.maxMoney, 10))}`)
        pp(ns, `Current values: security ${Math.floor(securityLevel * 1000) / 1000}; money $${numberWithCommas(parseInt(money, 10))}`)
        pp(ns, `Time to: hack ${convertMSToHHMMSS(hackTime)}; grow ${convertMSToHHMMSS(growTime)}; weaken ${convertMSToHHMMSS(weakenTime)}`)
        pp(ns, `Delays: ${convertMSToHHMMSS(hackDelay)} for hacks, ${convertMSToHHMMSS(growDelay)} for grows`)

        if (action === 'weaken') {
            pp(ns, "#Weaken action")
            if (settings().changes.weaken * weakenCycles > securityLevel - serverMapTarget.minSecurityLevel) {
                weakenCycles = Math.ceil((securityLevel - serverMapTarget.minSecurityLevel) / settings().changes.weaken)
                growCycles -= weakenCycles
                growCycles = Math.max(0, growCycles)

                weakenCycles += weakenCyclesForGrow(growCycles)
                growCycles -= weakenCyclesForGrow(growCycles)
                growCycles = Math.max(0, growCycles)
            } else {
                growCycles = 0
            }

            pp(ns, `Cycles ratio: ${growCycles} grow cycles; ${weakenCycles} weaken cycles; expected security reduction: ${Math.floor(settings().changes.weaken * weakenCycles * 1000) / 1000}`)

            rootedServers
                .map(host => serverMap.servers[host])
                .forEach(server => {
                    let cyclesFittable = Math.max(0, Math.floor(server.ram / 1.75))
                    const cyclesToRun = Math.max(0, Math.min(cyclesFittable, growCycles))

                    pp(ns, `#Cycles for ${server}: grow ${cyclesToRun}, weaken ${cyclesFittable}`)

                    if (growCycles) {
                        ns.exec('grow.js', server.host, cyclesToRun, bestTarget, cyclesToRun, growDelay, createUUID())
                        growCycles -= cyclesToRun
                        cyclesFittable -= cyclesToRun
                    }

                    if (cyclesFittable) {
                        ns.exec('weaken.js', server.host, cyclesFittable, bestTarget, cyclesFittable, 0, createUUID())
                        weakenCycles -= cyclesFittable
                    }
                })
        } else if (action === 'grow') {
            weakenCycles = weakenCyclesForGrow(growCycles)
            growCycles -= weakenCycles

            pp(ns, `Cycles ratio: ${growCycles} grow cycles; ${weakenCycles} weaken cycles`)

            rootedServers
                .map(host => serverMap.servers[host])
                .forEach(server => {
                    let cyclesFittable = Math.max(0, Math.floor(server.ram / 1.75))
                    const cyclesToRun = Math.max(0, Math.min(cyclesFittable, growCycles))

                    if (growCycles) {
                        ns.exec('grow.js', server.host, cyclesToRun, bestTarget, cyclesToRun, growDelay, createUUID())
                        growCycles -= cyclesToRun
                        cyclesFittable -= cyclesToRun
                    }

                    if (cyclesFittable) {
                        ns.exec('weaken.js', server.host, cyclesFittable, bestTarget, cyclesFittable, 0, createUUID())
                        weakenCycles -= cyclesFittable
                    }
                })
        } else {
            if (hackCycles > serverMapTarget.fullHackCycles) {
                hackCycles = serverMapTarget.fullHackCycles

                if (hackCycles * 100 < growCycles) {
                    hackCycles *= 10
                }

                growCycles = Math.max(0, growCycles - Math.ceil((hackCycles * 1.7) / 1.75))

                weakenCycles = weakenCyclesForGrow(growCycles) + weakenCyclesForHack(hackCycles)
                growCycles -= weakenCycles
                hackCycles -= Math.ceil((weakenCyclesForHack(hackCycles) * 1.75) / 1.7)

                growCycles = Math.max(0, growCycles)
            } else {
                growCycles = 0
                weakenCycles = weakenCyclesForHack(hackCycles)
                hackCycles -= Math.ceil((weakenCycles * 1.75) / 1.7)
            }

            pp(ns, `Cycles ratio: ${growCycles} grow cycles; ${weakenCycles} weaken cycles; ${hackCycles} hack cycles`)

            rootedServers
                .map(host => serverMap.servers[host])
                .forEach(server => {
                    let cyclesFittable = Math.max(0, Math.floor(server.ram / 1.7))
                    const cyclesToRun = Math.max(0, Math.min(cyclesFittable, hackCycles))

                    if (hackCycles) {
                        ns.exec('hack.js', server.host, cyclesToRun, bestTarget, cyclesToRun, hackDelay, createUUID())
                        hackCycles -= cyclesToRun
                        cyclesFittable -= cyclesToRun
                    }

                    const freeRam = server.ram - cyclesToRun * 1.7
                    cyclesFittable = Math.max(0, Math.floor(freeRam / 1.75))

                    if (cyclesFittable && growCycles) {
                        const growCyclesToRun = Math.min(growCycles, cyclesFittable)

                        ns.exec('grow.js', server.host, growCyclesToRun, bestTarget, growCyclesToRun, growDelay, createUUID())
                        growCycles -= growCyclesToRun
                        cyclesFittable -= growCyclesToRun
                    }

                    if (cyclesFittable) {
                        ns.exec('weaken.js', server.host, cyclesFittable, bestTarget, cyclesFittable, 0, createUUID())
                        weakenCycles -= cyclesFittable
                    }
                })
        }

        await ns.sleep(weakenTime + 300)
    }
}