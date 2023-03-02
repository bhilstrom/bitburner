/** @param {import(".").NS } ns */

export function settings() {
  return {
    hackPercent: .1,
    homeRamReserved: 35,
    minSecurityLevelOffset: 1,
    maxMoneyMultiplier: 1,
    minSecurityWeight: 100,
    mapRefreshInterval: 30 * 60 * 1000, // 30 minutes
    maxWeakenTime: 10 * 60 * 1000, // 10 minutes
    keys: {
      serverMap: 'BB_SERVER_MAP',
      hackTarget: 'BB_HACK_TARGET',
      action: 'BB_ACTION',
    },
    changes: {
      hack: 0.002,
      grow: 0.004,
      weaken: 0.05,
    },
  }
}

/** @param {import(".").NS } ns */
export async function runAndWaitFor(ns, scriptName, ...args) {
  await runAndWaitForThreads(ns, scriptName, 1, ...args)
}

/** @param {import(".").NS } ns */
export async function runAndWaitForThreads(ns, scriptName, threads, ...args) {
  if (!ns.exec(scriptName, 'home', threads, ...args)) {
    throw new Error(`Failed to start ${scriptName}`)
  }

  await ns.sleep(0)

  while (ns.scriptRunning(scriptName, 'home')) {
    await ns.sleep(100)
  }
}

/** @param {import(".").NS } ns */
export async function runAndWaitForSpider(ns) {
  await runAndWaitFor(ns, 'spider.js')
}

export function numberWithCommas(x) {
  return x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ',')
}

export function getItem(key) {
  let item = localStorage.getItem(key)

  return item ? JSON.parse(item) : undefined
}

export function localeHHMMSS(ms = 0) {
  if (!ms) {
    ms = new Date().getTime()
  }

  return new Date(ms).toLocaleTimeString()
}

/** @param {import(".").NS } ns */
export function pp(ns, str, showOnMainScreen = false) {

  str = `[${localeHHMMSS()}] ${str}`
  if (showOnMainScreen) {
    ns.tprint(str)
  } else {
    ns.print(str)
  }
}

export function setItem(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export async function main(ns) {
  return {
    settings,
    getItem,
    setItem,
  }
}

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

export function getHackPrograms() {
  return [
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
}

export function msToS(ms, decimalPlaces = 2) {
  const helper = Math.pow(10, decimalPlaces)
  return Math.round(ms / 1000 * helper) / helper
}

/** @param {import(".").NS } ns */
export function getPlayerDetails(ns) {
  const programs = []

  getHackPrograms().forEach((hackProgram) => {
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
export function hasFormulasAccess(ns) {
  return ns.fileExists('Formulas.exe', 'home')
}

export function getFactions() {
  return [
    'CyberSec',
    'Tian Di Hui',
    'Netburners',
    'Shadows of Anarchy',
    'Sector-12',
    'Chongqing',
    'New Tokyo',
    'Ishima',
    'Aevum',
    'Volhaven',
    'NiteSec',
    'The Black Hand',
    'BitRunners',
    'ECorp',
    'MegaCorp',
    'KuaiGong International',
    'Four Sigma',
    'NWO',
    'Blade Industries',
    'OmniTek Incorporated',
    'Bachman & Associates',
    'Clarke Incorporated',
    'Fulcrum Secret Technologies',
    'Slum Snakes',
    'Tetrads',
    'Silhouette',
    'Speakers for the Dead',
    'The Dark Army',
    'The Syndicate',
    'The Covenant',
    'Daedalus',
    'Illuminati',
  ]
}

/** @param {import(".").NS } ns */
export function forEachSleeve(ns, func) {
  const numSleeves = ns.sleeve.getNumSleeves()
  for (let sleeveNum = 0; sleeveNum < numSleeves; sleeveNum++) {
    func(sleeveNum)
  }
}

export function getCombatStats() {
  return [
    'strength',
    'defense',
    'dexterity',
    'agility'
  ]
}

/** @param {import(".").NS } ns */
export function getCities(ns) {
  return [
    ns.enums.CityName.Sector12,
    ns.enums.CityName.Chongqing,
    ns.enums.CityName.Aevum,
    ns.enums.CityName.Volhaven,
    ns.enums.CityName.NewTokyo,
    ns.enums.CityName.Ishima,
  ]
}

export const Ports = {
  BRAIN: 1,
  SLEEVE: 2,
  HACKNET: 3,
}

/** @param {import(".").NS } ns */
export function readFromPort(ns, number) {
  const result = ns.readPort(number)
  return result == "NULL PORT DATA" ? undefined : result
}

const hackingScripts = ['hack.js', 'grow.js', 'weaken.js', 'common.js', 'hack.batch.js', 'grow.batch.js', 'weaken.batch.js']

/** @param {import(".").NS } ns */
export function getHacknetNames(ns) {
  let names = []
  for (let i = 0; i < ns.hacknet.numNodes(); i++) {
    names.push(ns.hacknet.getNodeStats(i).name)
  }

  return names
}

/** @param {import(".").NS } ns */
export function getRootedServers(ns, servers) {

  const hacknetNames = getHacknetNames(ns)

  // Only include servers:
  // - With root access
  // - That aren't a hacknet server
  // - That have more than 1 ram
  const rootServers = Object.keys(servers)
    .filter(hostname => ns.serverExists(hostname))
    .filter(hostname => ns.hasRootAccess(hostname))
    .filter(hostname => !hacknetNames.includes(hostname))
    .filter(hostname => servers[hostname].ram >= 2)

  // Copy hacking scripts to rooted servers
  rootServers
    .filter(hostname => hostname !== "home")
    .forEach(hostname => ns.scp(hackingScripts, hostname))

  // Send scripts to:
  // - biggest servers first
  // - with 'home' last (we want to reserve it for grow scripts)
  rootServers.sort((a, b) => {
    if (b === 'home') {
      return -1
    } else if (a === 'home') {
      return 1
    }

    return servers[b].ram - servers[a].ram
  })
  return rootServers
}