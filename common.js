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
        decommissionFilename: 'decommission.txt',
    }
}

/** @param {import(".").NS } ns */
export async function runAndWaitForSpider(ns) {
    if (!ns.exec('spider.js', 'home', 1)) {
      throw new Error('Failed to start spider.js')
    }

    while (ns.scriptRunning('spider.js', 'home')) {
        await ns.sleep(1000)
    }
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