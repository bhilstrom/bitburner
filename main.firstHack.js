import { getHackPrograms, getPlayerDetails, getItem, settings, pp, runAndWaitForSpider } from './common.js'

/** @param {import(".").NS } ns */
async function trainHackingTo10(ns) {

    if (ns.getHackingLevel() >= 10) {
        pp(ns, 'Hack level is already 10 or above', true)
        return
    }

    pp(ns, `Hacking level less than 10, training up to 10 at university`, true)
    ns.singularity.universityCourse('Rothman University', 'Study Computer Science')

    while (ns.getHackingLevel() < 10) {
        await ns.sleep(1000)
    }
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    await trainHackingTo10(ns)

    // Make sure joesguns is rooted
    await runAndWaitForSpider(ns)

    const result = ns.exec('primaryHack.js', 'home', 1, 'early')
    if (!result) {
        throw new Error("Failed to start primaryHack, not hacking!")
    }

    pp(ns, 'Started hacking successfully.', true)
}