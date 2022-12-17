import { settings, pp } from './common.js'

/** @param {import(".").NS } ns */
function getRamToPurchase(ns, minRamPow = 3, maxRamPow = 20) {
    const availableMoney = ns.getPlayer().money

    let ramPow = minRamPow
    // 'ramPow + 1' math looks weird, but this will make the loop exit when we can afford ramPow, but not ramPow + 1
    while (ramPow < maxRamPow && ns.getPurchasedServerCost(Math.pow(2, ramPow + 1)) < availableMoney) {
        ramPow += 1
    }

    pp(ns, `Next available ram power to purchase: ${ramPow}`)
    return Math.pow(2, ramPow)
}

/** @param {import(".").NS } ns */
function getSortedServers(ns) {
    return ns.getPurchasedServers()
        .map(serverName => ns.getServer(serverName))
        .sort((a, b) => a.maxRam - b.maxRam)
}

/** @param {import(".").NS } ns */
async function decommissionAndKillServer(ns, hostname) {

    const DECOMMISSION_FILENAME = settings().decommissionFilename
    
    if (ns.fileExists(DECOMMISSION_FILENAME, 'home')) {
        ns.write(DECOMMISSION_FILENAME, 'Scheduled for decommission')
    }

    pp(ns, `Decommissioning ${hostname}`)
    ns.scp(DECOMMISSION_FILENAME, hostname)

    // While any script is running, sleepZ
    while (ns.getServerUsedRam(hostname) != 0) {
        pp(ns, `Scripts still running on ${hostname}...`)
        await ns.sleep(5000)
    }

    pp(ns, `No more scripts running on ${hostname}, deleting server`)
    ns.deleteServer(hostname)
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    pp(ns, 'Starting purchaseServers.js', true)

    let hostname = ns.getHostname()

    if (hostname !== 'home') {
        throw new Error('Run the script from home')
    }

    const serverNamePrefix = "pserv-"
    const purchasedServerLimit = ns.getPurchasedServerLimit()

    while (true) {

        let servers = getSortedServers(ns)
        // pp(ns, `Purchased servers: ${JSON.stringify(servers, null, 2)}`, true)
        let spiderDataRefreshNeeded = false

        // If we don't have enough servers, purchase the biggest one we can
        if (servers.length < purchasedServerLimit) {
            const ram = getRamToPurchase(ns)
            pp(ns, `Purchasing new server with ${ram} ram`, true)
            ns.purchaseServer(`${serverNamePrefix}${servers.length}`, ram)
            spiderDataRefreshNeeded = true
        } else {

            const smallestServer = servers[0]
            // We have enough servers.
            // If there's nothing left to upgrade, we're done.
            if (smallestServer.maxRam == Math.pow(2, 20)) {
                pp(ns, `All ${servers.length} servers at maximum RAM! WOO!`, true)
                ns.exit()
            }

            // We should check the smallest server and see if we can upgrade it.
            const affordableRam = getRamToPurchase(ns)
            if (affordableRam > smallestServer.maxRam) {
                pp(ns, `Upgrading ${smallestServer.hostname} from ${smallestServer.maxRam} to ${affordableRam}`, true)
                await decommissionAndKillServer(ns, smallestServer.hostname)
                ns.purchaseServer(smallestServer.hostname, affordableRam)
                spiderDataRefreshNeeded = true
            }
        }

        if (spiderDataRefreshNeeded) {
            pp(ns, 'Server data updated, running spider to update cache.')

            // We don't have to do anything else here, because this script doesn't rely on the spider's cache.
            // We just want things like primaryHack to work efficiently.
            ns.exec('spider.js', 'home')
        }

        await ns.sleep(5000)
    }
}