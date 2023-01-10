import { localeHHMMSS, settings, getItem, pp } from './common.js'

/** @param {import(".").NS } ns */
export function main(ns) {

    let index = 0
    pp(ns, `Index: ${index}`, true)
    pp(ns, `Index: ${index++}`, true)
    pp(ns, `Index: ${index++}`, true)
    pp(ns, `Index: ${index++}`, true)
    pp(ns, `Index: ${index++}`, true)

}