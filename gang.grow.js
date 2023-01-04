import { pp } from './common.js'
import { getMaxGangSize, getTrainingTaskName } from './gang.common'

const DELAY_AFTER_ASSIGNMENT = 100

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
function getLowestAscensionStat(memberInfo, isHackGang) {
    const multipliers = getRelevantAscensionMultipliers(isHackGang)
        .map(ability => memberInfo[ability])
        .sort((a, b) => a < b)

    return multipliers.shift()
}

function getDefaultCrime(isHackGang) {
    return isHackGang ? 'Ransomware' : 'Mug People'
}

function getCrimeForRep(isHackGang) {
    if (isHackGang) {
        throw new Error('Need to specify crime for rep for hack gang')
    }

    return 'Terrorism'
}

function getWantedLevelRemovalCrime(isHackGang) {
    if (isHackGang) {
        throw new Error('Need to specify crime for wanted level removal for hack gang')
    }

    return 'Vigilante Justice'
}

function getMoneyCrime(isHackGang) {
    if (isHackGang) {
        throw new Error('Need to specify crime for wanted level removal for hack gang')
    }

    return 'Human Trafficking'
}

// Get all the members, sorted by their lowest current ascension multiplier, with the highest member first
/** @param {import(".").NS } ns */
function getSortedGangMembers(ns, members, isHackGang) {
    return members
        .map(memberName => ns.gang.getMemberInformation(memberName))
        .sort((memberInfoA, memberInfoB) => {

            const lowestA = getLowestAscensionStat(memberInfoA, isHackGang)
            const lowestB = getLowestAscensionStat(memberInfoB, isHackGang)

            return lowestB - lowestA
        })
        .map(memberInfo => memberInfo.name)

}

/** @param {import(".").NS } ns */
function getTargetCrimeOrWantedRemoval(ns, targetCrime, wantedLevelRemovalCrime) {
    const gangInfo = ns.gang.getGangInformation()
    let crime = targetCrime
    if (gangInfo.respectGainRate < (10000 * gangInfo.wantedLevelGainRate)) {
        pp(ns, `Respect gain rate is ${gangInfo.respectGainRate}, wanted gain is ${gangInfo.wantedLevelGainRate}`)
        crime = wantedLevelRemovalCrime
    }

    return crime
}

async function purchaseWarfareEquipment(ns, memberName) {
    return
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    [
        "sleep",
    ].forEach(logName => ns.disableLog(logName))

    const isHackGang = ns.gang.getGangInformation().isHacking
    pp(ns, `Hack gang: ${isHackGang}`, true)

    // While we have fewer than max gang,
    // half our people should gain rep as fast as possible.
    // Other half should train.
    const trainingTask = getTrainingTaskName(isHackGang)
    const crimeForRep = getCrimeForRep(isHackGang)
    const wantedLevelRemovalCrime = getWantedLevelRemovalCrime(isHackGang)
    let members = ns.gang.getMemberNames()
    while (members.length < getMaxGangSize()) {


/*
new plan:
mug people until 6 members
move to "half train, half recruit crime"
(modify recruit crime method, return mug people
    if lowest stat < 500, else terrorism)
once full, move to 1 safe money, all else train
*/

        const sortedMemberNames = getSortedGangMembers(ns, members, isHackGang)

        /*
        The ones with the highest values should be doing crime to get rep.
        The middle ones should doing either crime or wanted level removal.
        Everyone else should be training.
        A minimum of 1 person should be running crime.
        */
        ns.gang.setMemberTask(sortedMemberNames[0], crimeForRep)

        const numMembersForCrime = Math.ceil((members.length - 1) / 2)
        for (let i = 1; i < numMembersForCrime; i++) {

            // The gang info doesn't update instantly, so we need to delay slightly before our math works
            await ns.sleep(DELAY_AFTER_ASSIGNMENT)

            const crime = getTargetCrimeOrWantedRemoval(ns, crimeForRep, wantedLevelRemovalCrime)
            ns.gang.setMemberTask(sortedMemberNames[i], crime)
        }

        for (let i = numMembersForCrime; i < members.length; i++) {
            ns.gang.setMemberTask(sortedMemberNames[i], trainingTask)
        }

        members = ns.gang.getMemberNames()
        await ns.sleep(30000)
    }

    pp(ns, `Max gang member count of ${getMaxGangSize()} acquired!`, true)

    // We have max gang. Time to get territory.
    // Each member trains until 4k in all combat stats.
    // Everyone above 4k in combat stats goes does Territory Warfare.
    // Once we would win all of the fights, start fighting.
    // Loop until we own everything
    let gangInfo = ns.gang.getGangInformation()
    while (gangInfo.territory < 1) {

        for (let i = 0; i < members.length; i++) {
            const member = members[i]
            const memberInfo = ns.gang.getMemberInformation(member)

            if (getLowestAscensionStat(memberInfo, isHackGang) < 2000) {
                ns.gang.setMemberTask(member, trainingTask)
            } else {
                ns.gang.setMemberTask(member, 'Territory Warfare')
                await purchaseWarfareEquipment(ns, member)
            }
        }

        // If other gangs are stronger, keep war off.
        // Otherwise, turn on war
        const otherGangInfo = ns.gang.getOtherGangInformation()
        if (Object.keys(otherGangInfo).some(gangName => {

            // Don't compare us against our own gang.
            if (gangName == gangInfo.faction) {
                return false
            }

            const otherGang = otherGangInfo[gangName]

            if (otherGang.power > gangInfo.power) {
                pp(ns, `${gangName} has power ${otherGang.power}, which is greater than our ${gangInfo.power} power.`)
            }
            return otherGang.power > gangInfo.power
        })) {
            ns.gang.setTerritoryWarfare(false)
        } else {
            if (!gangInfo.territoryWarfareEngaged) {
                pp(ns, "We're the strongest gang. WAAAAAAGH!", true)
                ns.gang.setTerritoryWarfare(true)
            }
        }

        await ns.sleep(30000)
        gangInfo = ns.gang.getGangInformation()
    }

    pp(ns, 'The world is ours! Max gang territory achieved!', true)

    // We own everything. Turn off territory combat and make money
    ns.gang.setTerritoryWarfare(false)

    const moneyCrime = getMoneyCrime(isHackGang)
    while (true) {

        const sortedMemberNames = getSortedGangMembers(ns, members, isHackGang)

        // The strongest should always make money.
        let member = sortedMemberNames[0]
        ns.gang.setMemberTask(member, moneyCrime)

        let anyNotMakingMoney = false
        for (let i = 1; i < sortedMemberNames.length; i++) {

            // The gang info doesn't update instantly, so we need to delay slightly before our math works
            await ns.sleep(DELAY_AFTER_ASSIGNMENT)

            member = sortedMemberNames[i]
            const memberInfo = ns.gang.getMemberInformation(member)

            let crime = getTargetCrimeOrWantedRemoval(ns, moneyCrime, wantedLevelRemovalCrime)
            if (crime === crimeForRep && getLowestAscensionStat(memberInfo, isHackGang) < 7000) {
                crime = trainingTask
            }

            if (crime !== moneyCrime) {
                anyNotMakingMoney = true
            }
            ns.gang.setMemberTask(sortedMemberNames[i], crime)
        }

        if (!anyNotMakingMoney) {
            pp(ns, "All gang members making money!", true)
            ns.exit()
        }

        await ns.sleep(30000)
    }
}