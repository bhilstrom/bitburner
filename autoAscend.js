import { ascend, autocomplete as ascendAutoComplete } from './ascend.js'

/** @param {import(".").NS } ns */
export async function main(ns) {

    // Only auto-ascend if we didn't encounter errors
    const ascendResult = await ascend(ns, ...ns.args)
    if (!ascendResult) {
        return
    }

    ns.singularity.installAugmentations('ascend.postAscend.js')
}

export function autocomplete(data, args) {
    return ascendAutoComplete(data, args)
}