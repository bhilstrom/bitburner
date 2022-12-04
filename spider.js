import { settings, setItem, pp } from './common.js'

/** @param {import(".").NS } ns */
function brute(ns, host) {
  ns.brutessh(host)
}

/** @param {import(".").NS } ns */
function ftpcrack(ns, host) {
  ns.ftpcrack(host)
}

/** @param {import(".").NS } ns */
function relaySMTP(ns, host) {
  ns.relaysmtp(host)
}

/** @param {import(".").NS } ns */
function httpWorm(ns, host) {
  ns.httpworm(host)
}

/** @param {import(".").NS } ns */
function sqlInject(ns, host) {
  ns.sqlinject(host)
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

/** @param {import(".").NS } ns */
function getPlayerDetails(ns) {
  const programs = []

  hackPrograms.forEach((hackProgram) => {
    if (ns.fileExists(hackProgram.name, 'home')) {
      pp(ns, `Found hack program ${hackProgram.name}`)
      programs.push(hackProgram)
    }
  })

  return {
    hackingLevel: ns.getHackingLevel(),
    programs
  }
}

/** @param {import(".").NS } ns */
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

    pp(ns, `Processing ${host}...`)

    serverMap.servers[host] = {
      host,
      ports: ns.getServerNumPortsRequired(host),
      hackingLevel: ns.getServerRequiredHackingLevel(host),
      maxMoney: ns.getServerMaxMoney(host),
      growth: ns.getServerGrowth(host),
      minSecurityLevel: ns.getServerMinSecurityLevel(host),
      ram: ns.getServerMaxRam(host),
      files: ns.ls(host),
    }

    if (!ns.hasRootAccess(host)) {
      const neededPorts = serverMap.servers[host].ports
      const neededHackingLevel = serverMap.servers[host].hackingLevel

      pp(ns, `Missing root on ${host}. Need ${neededPorts - playerDetails.programs.length} ports, ${neededHackingLevel - playerDetails.hackingLevel} Hack`)

      if (neededPorts <= playerDetails.programs.length && neededHackingLevel <= playerDetails.hackingLevel) {
        pp(ns, `Gaining root on ${host}`)
        playerDetails.programs.forEach(hackProgram => {
            pp(ns, `Running ${hackProgram.name}...`)
            hackProgram.exe(ns, host)
          })
        pp(ns, `Nuking...`)
        ns.nuke(host)
        pp(ns, `${host} nuked!`)
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

  if (scriptToRunAfter) {
    pp(ns, `Spawning ${scriptToRunAfter}`)
    ns.spawn(scriptToRunAfter, 1)
  } else {
    pp(ns, `Done`)
  }
}
