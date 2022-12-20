import { pp } from './common.js'
import { getTrainingTaskName } from './gang.common'

const ASCENSION_MULTIPLIERS = {
    hacking: [
        'hack',
    ],
    combat: [
        'agi',
        'def',
        'dex',
        'str',
    ]
}

/**
 * @param {import(".").NS } ns
 * @param {import(".").GangMemberInfo} current 
 * @param {import(".").GangMemberAscension} future 
 */
function shouldAscend(ns, isHackGang, memberName) {

    const multipliers = ASCENSION_MULTIPLIERS[isHackGang ? 'hacking' : 'combat']

    const future = ns.gang.getAscensionResult(memberName)

    // Sometimes, the ascension result is undefined
    return future !== undefined && multipliers.some(ability => future[ability] > 2)
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    [
        "sleep",
    ].forEach(logName => ns.disableLog(logName))

    const isHackGang = ns.gang.getGangInformation().isHacking
    const trainingTaskName = getTrainingTaskName(isHackGang)

    while (true) {

        const membersToAscend = ns.gang.getMemberNames()
            .filter(memberName => ns.gang.getMemberInformation(memberName).task === trainingTaskName)
            .filter(memberName => shouldAscend(ns, isHackGang, memberName))

        membersToAscend.forEach(memberName => {
            pp(ns, `Ascending ${memberName}`, true)
            ns.gang.ascendMember(memberName)
        })

        await ns.sleep(15000)
    }
}