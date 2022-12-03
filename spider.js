/** @param {import(".").NS } ns */
import { settings, setItem, pp } from 'common.js'

function brute(ns, host) {
  ns.brute(host);
}

function ftpcrack(ns, host) {
  ns.ftpcrack(host);
}

function relaySMTP(ns, host) {
  ns.relaySMTP(host);
}

function httpWorm(ns, host) {
  ns.httpWorm(host);
}

function sqlInject(ns, host) {
  ns.sqlInject(host);
}

const hackPrograms = [
  {
    name: 'BruteSSH.exe',
    exe: brute,
  },
  {
    name: 'FTPCrack.exe',
    exe: ftpcrack,
  },
  {
    name: 'relaySMTP.exe',
    exe: relaySMTP,
  },
  {
    name: 'HTTPWorm.exe',
    exe: httpWorm,
  },
  {
    name: 'SQLInject.exe',
    exe: sqlInject,
  }
]

function getPlayerDetails(ns) {
  let portHacks = 0

  hackPrograms.forEach((hackProgram) => {
    if (ns.fileExists(hackProgram.name, 'home')) {
      pp(ns, `Found hack program ${hackProgram}`)
      portHacks += 1
    }
  })

  return {
    hackingLevel: ns.getHackingLevel(),
    portHacks,
  }
}

export async function main(ns) {
  pp(ns, "Starting spider.js")

  const scriptToRunAfter = ns.args[0]

  let hostname = ns.getHostname()

  if (hostname !== 'home') {
    throw new Exception('Run the script from home')
  }

  const playerDetails = getPlayerDetails(ns)

  const serverMap = { servers: {}, lastUpdate: new Date().getTime() }
  const scanArray = ['home']
  

  while (scanArray.length) {
    const host = scanArray.shift()

    pp(ns, "Getting details for " + host)

    serverMap.servers[host] = {
      host,
      ports: ns.getServerNumPortsRequired(host),
      hackingLevel: ns.getServerRequiredHackingLevel(host),
      maxMoney: ns.getServerMaxMoney(host),
      growth: ns.getServerGrowth(host),
      minSecurityLevel: ns.getServerMinSecurityLevel(host),
      ram: ns.getServerRam(host)[0],
      files: ns.ls(host),
    }

    if (!ns.hasRootAccess(host)) {
      pp(ns, `Missing root on ${host}`)

      if (serverMap.servers[host].ports <= playerDetails.portHacks && serverMap.servers[host].hackingLevel <= playerDetails.hackingLevel) {
        pp(ns, `Gaining root on ${host}`)
        hackPrograms.forEach((hackProgram) => {
          hackProgram.exe(ns, host)
        })
        ns.nuke(host)
        pp(ns, `${host} nuked`)
      }
    }

    const connections = ns.scan(host) || ['home']
    serverMap.servers[host].connections = connections

    connections.filter((hostname) => !serverMap.servers[hostname]).forEach((hostname) => scanArray.push(hostname))
  }

  let hasAllParents = false

  while (!hasAllParents) {
    hasAllParents = true

    Object.keys(serverMap.servers).forEach((hostname) => {
      const server = serverMap.servers[hostname]

      if (!server.parent) hasAllParents = false

      if (hostname === 'home') {
        server.parent = 'home'
        server.children = server.children ? server.children : []
      }

      if (hostname.includes('pserv-')) {
        server.parent = 'home'
        server.children = []

        if (serverMap.servers[server.parent].children) {
          serverMap.servers[server.parent].children.push(hostname)
        } else {
          serverMap.servers[server.parent].children = [hostname]
        }
      }

      if (!server.parent) {
        if (server.connections.length === 1) {
          server.parent = server.connections[0]
          server.children = []

          if (serverMap.servers[server.parent].children) {
            serverMap.servers[server.parent].children.push(hostname)
          } else {
            serverMap.servers[server.parent].children = [hostname]
          }
        } else {
          if (!server.children) {
            server.children = []
          }

          if (server.children.length) {
            const parent = server.connections.filter((hostname) => !server.children.includes(hostname))

            if (parent.length === 1) {
              server.parent = parent.shift()

              if (serverMap.servers[server.parent].children) {
                serverMap.servers[server.parent].children.push(hostname)
              } else {
                serverMap.servers[server.parent].children = [hostname]
              }
            }
          }
        }
      }
    })
  }

  setItem(settings().keys.serverMap, serverMap)

  pp(ns, `Server map: ${serverMap}`)

  // if (!scriptToRunAfter) {
  //   ns.tprint(`[${localeHHMMSS()}] Spawning mainHack.js`)
  //   ns.spawn('mainHack.js', 1)
  // } else {
  //   ns.tprint(`[${localeHHMMSS()}] Spawning ${scriptToRunAfter}`)
  //   ns.spawn(scriptToRunAfter, 1)
  // }
}
