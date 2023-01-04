import { settings, getItem, pp } from './common.js'

export function getConnectionPath(ns, target, serverMap) {

    if (ns.getHostname() !== 'home') {
        throw new Error('Must get connection path from home')
    }

    if (!Object.keys(serverMap.servers).includes(target)) {
        throw new Error(`${target} not present in server map`)
    }

    const path = []
    while(target && target !== 'home') {
        path.unshift(target)
        target = serverMap.servers[target].parent
    }

    return path
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    pp(ns, "Starting findConnection.js", true)

    if (ns.getHostname() !== 'home') {
        throw new Error('Must be run from home')
    }

    let target = ns.args[0]
    if (!target) {
        throw new Error('Must be run with a target (e.g., run findCommand.js CSEC)')
    }

    const serverMap = getItem(settings().keys.serverMap)

    if (!serverMap || serverMap.lastUpdate < new Date().getTime() - settings().mapRefreshInterval) {
        pp(ns, "Server refresh needed, spawning spider", true)
        ns.spawn("spider.js", 1, "findConnection.js", ...ns.args)
        ns.exit()
        return
    }

    pp(ns, `Looking for path to ${target}`)
    if (!serverMap.servers[target]) {

        const lowerCaseTarget = target.toLowerCase()
        const possibleServers = Object.keys(serverMap.servers)
            .filter(host => host.toLowerCase().includes(lowerCaseTarget))

        if (possibleServers.length > 1) {
            pp(ns, `${target} not found. Targets containing '${target}': ${JSON.stringify(possibleServers, null, 2)}`, true)
            ns.exit()
        } else {
            // Only found one possible target, assume that's what we meant
            target = possibleServers[0]
        }
    }

    const server = serverMap.servers[target]

    pp(ns, `${target} found! Server: ${JSON.stringify(server, null, 2)}`, true)

    // Connection path is reversed here, because we build it backwards
    const connectionPath = getConnectionPath(ns, target, serverMap).reverse()

    let connectionString = server.backdoorInstalled ? '' : 'backdoor;'
    connectionPath.forEach(hostname => connectionString = `connect ${hostname};` + connectionString)
    
    connectionString = `home;` + connectionString

    pp(ns, `Connection string copied to clipboard: ${connectionString}`, true)
    navigator.clipboard.writeText(connectionString)
}
