import { localeHHMMSS, settings, getItem, pp } from './common.js'

/** @param {import(".").NS } ns */
export function main(ns) {

    pp(ns, `Weaken analyze: ${ns.weakenAnalyze(1)}`)

    const host = 'catalyst'

    const currentSecurity = ns.getServerSecurityLevel(host)
    const minSecurity = ns.getServerMinSecurityLevel(host)

    pp(ns, `Current security: ${currentSecurity}, min security: ${minSecurity}`)

    let threads = 0
    let newSecurity = currentSecurity

    // We need this to enable backtracking
    let oldSecurity = newSecurity

    // Double estimated threads each time
    for (let i = 0; i < 10; i++) {
        threads = Math.max(1, threads * 2)
        oldSecurity = newSecurity
        newSecurity = currentSecurity - ns.weakenAnalyze(threads)
        pp(ns, `After ${i}: threads ${threads}, oldSecurity ${oldSecurity}, newSecurity ${newSecurity}`)
    }
    
}