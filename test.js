import { localeHHMMSS, settings, getItem, pp } from './common.js'

/** @param {import(".").NS } ns */
export function main(ns) {

    const script = ns.args[0]

    const ramUsed = ns.getScriptRam(script)

    pp(ns, `${script} uses ${ramUsed} RAM`, true)
}