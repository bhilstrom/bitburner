/** @param {import(".").NS } ns */
export function main(ns) {
    ns.tprint(eval("ns." + ns.args[0]));
}