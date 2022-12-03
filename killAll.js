import { settings, getItem, pp } from 'common.js'

/** @param {import(".").NS } ns */
export async function main(ns) {
    pp(ns, "Starting killAll.js")

    let hostname = ns.getHostname()

    if (hostname !== 'home') {
        throw new Exception('Run the script from home')
    }

    const serverMap = getItem(settings().keys.serverMap)

    if (!serverMap || serverMap.lastUpdate < new Date().getTime() - settings().mapRefreshInterval) {
        pp(ns, "Server refresh needed, spawning spider")
        ns.spawn("spider.js", 1, "autoHack.js")
        ns.exit()
        return
    }

    const killableServers = Object.keys(serverMap.servers)
        .filter(hostname => ns.serverExists(hostname))
        .filter(hostname => hostname !== 'home')

    killableServers.forEach(hostname => {
        ns.killall(hostname, true)
    })

    pp(ns, "All processes killed")
}