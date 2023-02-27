import { Ports, pp } from "./common";
import { HacknetAction } from "./daemon.hacknet";

/** @param {import(".").NS } ns */
export async function main(ns) {

    const arg = ns.args[0]

    if (!Object.keys(HacknetAction).includes(arg)) {
        pp(ns, `Invalid argument '${arg}', no command sent to hacknet.`, true)
        return
    }

    pp(ns, `Sending ${arg} command to hacknet`, true)
    ns.writePort(Ports.HACKNET, arg)
}

export function autocomplete(data, args) {
    return Object.values(HacknetAction)
}