import { runAndWaitFor, pp } from './common.js'

/** @param {import(".").NS } ns */
export async function main(ns) {

    runAndWaitFor(ns, 'ascend.js')

    ns.singularity.installAugmentations('ascend.postAscend.js')
}