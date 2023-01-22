import { ascend, autocomplete as ascendAutoComplete } from './ascend.js'

/** @param {import(".").NS } ns */
export async function main(ns) {

    // Only auto-ascend if we didn't encounter errors
    if (!ascend(ns, ns.args)) {
        return
    }

    ns.singularity.installAugmentations('ascend.postAscend.js')
}

export function autocomplete(data, args) {
    return ascendAutoComplete(data, args)
}