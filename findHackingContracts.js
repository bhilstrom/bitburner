import { settings, getItem, pp } from './common.js'


/** @param {import(".").NS } ns */
export async function main(ns) {
    pp(ns, "Starting findHackingContracts.js")

    if (ns.getHostname() !== 'home') {
        throw new Error('Must be run from home')
    }

    const serverMap = getItem(settings().keys.serverMap)

    if (!serverMap || serverMap.lastUpdate < new Date().getTime() - settings().mapRefreshInterval) {
        pp(ns, "Server refresh needed, spawning spider")
        ns.spawn("spider.js", 1, "findHackingContracts.js")
        ns.exit()
        return
    }

    const serversWithContracts = Object.values(serverMap.servers)
        .filter(server => server.files.some(file => file.includes(".cct")))
        .map(server => server.host)
    
    if (!serversWithContracts) {
        pp(ns, "No contracts found.")
    } else {
        pp(ns, `Contracts found on: ${JSON.stringify(serversWithContracts, null, 2)}`)
    }
}
