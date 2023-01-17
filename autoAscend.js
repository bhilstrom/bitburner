import { runAndWaitFor, pp } from './common.js'

/** @param {import(".").NS } ns */
export async function main(ns) {

    await runAndWaitFor(ns, 'ascend.js')

    ns.singularity.installAugmentations('ascend.postAscend.js')
}