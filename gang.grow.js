import { pp } from './common.js'
import { getMaxGangSize, getTrainingTaskName } from './gang.common'

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

function getRelevantAscensionMultipliers(isHackGang) {
    return ASCENSION_MULTIPLIERS[isHackGang ? 'hacking' : 'combat']
}

/**
 * @param {import(".").GangMemberInfo} memberInfo 
 */
function getLowestAscensionMultiplier(memberInfo, isHackGang) {
    const multipliers = getRelevantAscensionMultipliers(isHackGang)
        .map(ability => memberInfo[ability])
        .sort((a, b) => a < b)

    return multipliers.shift()
}

function getDefaultCrime(isHackGang) {
    return isHackGang ? 'Ransomware' : 'Mugging'
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    [
        "sleep",
    ].forEach(logName => ns.disableLog(logName))

    const isHackGang = ns.gang.getGangInformation().isHacking
    pp(ns, `Hack gang: ${isHackGang}`, true)

    let members = ns.gang.getMemberNames()
    while (members.length < getMaxGangSize()) {

        // Get all the members, sorted by their lowest current ascension multiplier, with the highest member first
        const sortedMemberNames = members
            .map(memberName => ns.gang.getMemberInformation(memberName))
            .sort((memberInfoA, memberInfoB) => {

                const lowestA = getLowestAscensionMultiplier(memberInfoA, isHackGang)
                const lowestB = getLowestAscensionMultiplier(memberInfoB, isHackGang)

                return lowestB - lowestA
            })
            .map(memberInfo => memberInfo.name)

        /*
        The ones with the highest values should be doing crime, everyone else should be training.
        A minimum of 1 person should be running crime.
        */
        const defaultCrime = getDefaultCrime(isHackGang)
        const numMembersForCrime = Math.ceil(members.length / 2)
        for (let i = 0; i < numMembersForCrime; i++) {
            ns.gang.setMemberTask(sortedMemberNames[i], defaultCrime)
        }

        const trainingTask = getTrainingTaskName(isHackGang)
        for (let i = numMembersForCrime; i < members.length; i++) {
            ns.gang.setMemberTask(sortedMemberNames[i], trainingTask)
        }

        members = ns.gang.getMemberNames()
        await ns.sleep(30000)
    }
}