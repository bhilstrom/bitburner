/** @param {import(".").NS } ns */

export function settings() {
    return {
        homeRamReserved: 20,
        homeRamReservedBase: 20,
        homeRamExtraRamReserved: 12,
        homeRamBigMode: 64,
        minSecurityLevelOffset: 1,
        maxMoneyMultiplayer: 0.9,
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

export function pp(ns, str, ms = 0) {
    ns.tprint(`[${localeHHMMSS(ms)}] ${str}`)
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
