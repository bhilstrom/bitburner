import { getPlayerDetails, settings, setItem, pp } from './common.js'

/** @param {import(".").NS } ns */
function getServer(ns, host) {

  const server = ns.getServer(host)

  return {
    host,
    ports: server.numOpenPortsRequired,
    hackingLevel: server.requiredHackingSkill,
    maxMoney: server.moneyMax,
    growth: server.serverGrowth,
    minSecurityLevel: server.minDifficulty,
    ram: server.maxRam,
    files: ns.ls(host),
    backdoorInstalled: server.backdoorInstalled,
    hasRootAccess: server.hasAdminRights,
    cores: server.cpuCores
  }
}

/** @param {import(".").NS } ns */
export async function main(ns) {
  pp(ns, "Starting spider.js", true)

  const scriptToRunAfter = ns.args[0]

  let hostname = ns.getHostname()

  if (hostname !== 'home') {
    throw new Error('Run the script from home')
  }

  const playerDetails = getPlayerDetails(ns)

  const serverMap = { servers: {}, lastUpdate: new Date().getTime() }
  const scanArray = ['home']


  while (scanArray.length) {
    const host = scanArray.shift()

    pp(ns, `Processing ${host}...`)

    const server = getServer(ns, host)
    serverMap.servers[host] = server

    if (!server.hasRootAccess) {
      const neededPorts = server.ports
      const neededHackingLevel = server.hackingLevel

      pp(ns, `Missing root on ${host}. Need ${neededPorts - playerDetails.programs.length} ports, ${neededHackingLevel - playerDetails.hackingLevel} Hack`)

      if (neededPorts <= playerDetails.programs.length && neededHackingLevel <= playerDetails.hackingLevel) {
        pp(ns, `Gaining root on ${host}`)
        playerDetails.programs.forEach(hackProgram => {
            pp(ns, `Running ${hackProgram.name}...`)
            hackProgram.exe(ns, host)
          })
        pp(ns, `Nuking...`)
        ns.nuke(host)
        pp(ns, `${host} nuked!`, true)
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
    pp(ns, `Spawning ${scriptToRunAfter}`, true)
    ns.spawn(scriptToRunAfter, 1, ...ns.args.slice(1))
  } else {
    pp(ns, `Done`, true)
  }
}
