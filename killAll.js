import { settings, getItem, pp } from './common.js'

/** @param {import(".").NS } ns */
export async function main(ns) {
    pp(ns, "Starting killAll.js", true)

    const killOnHome = ns.args[0]

    let hostname = ns.getHostname()

    if (hostname !== 'home') {
        throw new Error('Run the script from home')
    }

    const serverMap = getItem(settings().keys.serverMap)

    if (!serverMap || serverMap.lastUpdate < new Date().getTime() - settings().mapRefreshInterval) {
        pp(ns, "Server refresh needed, spawning spider", true)
        ns.spawn("spider.js", 1, "killAll.js")
        ns.exit()
        return
    }

    let killableServers = Object.keys(serverMap.servers)
        .filter(hostname => ns.serverExists(hostname))

    if (!killOnHome) {
        killableServers = killableServers.filter(hostname => hostname !== 'home')
    }

    killableServers.forEach(hostname => {
        ns.killall(hostname, true)
    })

    pp(ns, "All processes killed", true)
}

export function autocomplete(data, args) {
    return [true]
}