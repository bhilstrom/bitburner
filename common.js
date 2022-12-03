/** @param {import(".").NS } ns */

export function settings() {
    return {
        minSecurityLevelOffset: 2,
        maxMoneyMultiplayer: 0.9,
        minSecurityWeight: 100,
        mapRefreshInterval: 2 * 60 * 60 * 1000, // 2 hours
        keys: {
            serverMap: 'BB_SERVER_MAP',
            hackTarget: 'BB_HACK_TARGET',
            action: 'BB_ACTION',
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
