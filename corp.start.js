import { settings, getItem, pp } from './common.js'

/**
 * @param {import(".").NS } ns
 */
function hasCorp(ns) {
    return ns.corporation.hasCorporation()
}

/**
 * @param {import(".").NS } ns
 */
function createCorp(ns) {
    let c = ns.corporation
    c.createCorporation()
}

/**
 * @param {import(".").NS } ns
 */
export async function main(ns) {
    ns.disableLog("ALL")

    let c = ns.corporation

    const steps = [
        {
            condition: hasCorp,
            action: createCorp,
        }
    ]
}