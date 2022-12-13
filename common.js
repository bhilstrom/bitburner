/** @param {import(".").NS } ns */

export function settings() {
    return {
        homeRamReserved: 20,
        homeRamReservedBase: 20,
        homeRamExtraRamReserved: 12,
        homeRamBigMode: 64,
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
        decommissionFilename: 'decommission.txt'
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
