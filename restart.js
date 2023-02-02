import { pp } from "./common"

/** @param {import(".").NS } ns */
export async function main(ns) {

    const scriptName = ns.args[0]

    if (!ns.fileExists(scriptName, 'home')) {
        pp(ns, `ERROR: Cannot restart ${scriptName}, must be a script name.`, true)
        return
    }

    const script = ns.getRunningScript(scriptName, 'home')
    if (!script) {
        pp(ns, `ERROR: ${scriptName} is not currently running, cannot restart it.`, true)
        return
    }

    pp(ns, `Killing ${scriptName}...`, true)
    if (!ns.kill(script.pid)) {
        pp(ns, `ERROR: Failed to kill ${scriptName}`, true)
        return
    }

    pp(ns, `${scriptName} successfully killed, re-running...`, true)
    if (!ns.exec(script.filename, script.server, script.threads, ...script.args)) {
        pp(ns, `ERROR: Failed to start ${scriptName}.`, true)
        return
    }

    pp(ns, `${scriptName} restarted successfully!`, true)
}

export function autocomplete(data, args) {
    return data.scripts
}