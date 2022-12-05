import { settings, getItem, pp } from './common.js'


/** @param {import(".").NS } ns */
export async function main(ns) {
    pp(ns, "Starting findConnection.js")

    if (ns.getHostname() !== 'home') {
        throw new Error('Must be run from home')
    }

    let target = ns.args[0]
    if (!target) {
        throw new Error('Must be run with a target (e.g., run findCommand.js CSEC)')
    }

    const serverMap = getItem(settings().keys.serverMap)

    if (!serverMap || serverMap.lastUpdate < new Date().getTime() - settings().mapRefreshInterval) {
        pp(ns, "Server refresh needed, spawning spider")
        ns.spawn("spider.js", 1, "findConnection.js", ...ns.args)
        ns.exit()
        return
    }

    pp(ns, `Looking for path to ${target}`)
    if (!serverMap.servers[target]) {

        const lowerCaseTarget = target.toLowerCase()
        const possibleServers = Object.keys(serverMap.servers)
            .filter(host => host.toLowerCase().includes(lowerCaseTarget))

        pp(ns, `${target} not found. Targets containing '${target}': ${JSON.stringify(possibleServers, null, 2)}`)
        ns.exit()
    }

    let connectionString = ''
    while (target && target !== 'home') {
        connectionString = `connect ${target};` + connectionString
        target = serverMap.servers[target].parent
    }

    connectionString = `home;` + connectionString

    pp(ns, `Connection string: ${connectionString}`)
}
