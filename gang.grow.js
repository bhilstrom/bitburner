import { pp } from './common.js'
import { getMaxGangSize, getTrainingTaskName } from './gang.common'

const DELAY_AFTER_ASSIGNMENT = 100
const COMBAT_WIN_THRESHOLD = .75

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

function getCrimeForRep(memberInfo, isHackGang) {
    if (isHackGang) {
        throw new Error('Need to specify crime for rep for hack gang')
    }

    // Terrorism only works at high stat levels.
    if (getLowestAscensionStat(memberInfo) < 500) {
        return getDefaultCrime(isHackGang)
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
function getSortedGangMemberInfos(ns, members, isHackGang) {
    return members
        .map(memberName => ns.gang.getMemberInformation(memberName))
        .sort((memberInfoA, memberInfoB) => {

            const lowestA = getLowestAscensionStat(memberInfoA, isHackGang)
            const lowestB = getLowestAscensionStat(memberInfoB, isHackGang)

            return lowestB - lowestA
        })
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

/** @param {import(".").NS } ns */
function assignToTask(ns, memberInfo, task) {
    if (memberInfo.task !== task) {
        pp(ns, `Assigning ${memberInfo.name} to ${task}`)
        ns.gang.setMemberTask(memberInfo.name, task)
    }
}

async function purchaseWarfareEquipment(ns, memberName) {
    return
}

/** @param {import(".").NS } ns */
function getEquipmentToPurchase(ns, isHackGang) {
    return ns.gang.getEquipmentNames()
        .filter(name => {
            const stats = ns.gang.getEquipmentStats(name)
            return getRelevantAscensionMultipliers(isHackGang)
                .some(ability => stats[ability] > 1)
        })
}

/**
 * @param {import(".").NS } ns
 * @param {import(".").GangMemberInfo} memberInfo
 */
function purchaseEquipment(ns, memberInfo, equipmentToPurchase) {
    for (let i = 0; i < equipmentToPurchase.length; i++) {
        const equipment = equipmentToPurchase[i]
        if (memberInfo.upgrades.includes(equipment)) {
            continue
        }

        if (memberInfo.augmentations.includes(equipment)) {
            continue
        }

        if (!ns.gang.purchaseEquipment(memberInfo.name, equipment)) {
            pp(ns, `Failed to purchase ${equipment} for ${memberInfo.name}`)
            return false
        }
    }

    return true
}

/**
 * @param {import(".").NS } ns
 * @param {import(".").GangMemberInfo} memberInfo
 */
async function purchaseAllEquipment(ns, memberInfos, equipmentToPurchase) {
    for (let i = 0; i < memberInfos.length; i++) {
        const memberInfo = memberInfos[i]
        while (!purchaseEquipment(ns, memberInfo, equipmentToPurchase)) {
            await ns.sleep(30 * 1000)
        }
    }
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    [
        "sleep",
    ].forEach(logName => ns.disableLog(logName))

    const isHackGang = ns.gang.getGangInformation().isHacking
    pp(ns, `Hack gang: ${isHackGang}`, true)

    const RELEVANT_EQUIPMENT = getEquipmentToPurchase(ns, isHackGang)
    pp(ns, `List of equipment to purchase for gang: ${JSON.stringify(RELEVANT_EQUIPMENT, null, 2)}`)

    // While we have fewer than max gang,
    // half our people should gain rep as fast as possible.
    // Other half should train.
    const trainingTask = getTrainingTaskName(isHackGang)
    const wantedLevelRemovalCrime = getWantedLevelRemovalCrime(isHackGang)
    let members = ns.gang.getMemberNames()

    // Mug people until we have 6 members, because mugging is safe
    // and doable at low levels
    if (members.length < 6) {
        pp(ns, 'We have fewer than 6 members, setting everyone available to Mug until we have enough members.', true)
    }
    while (members.length < 6) {

        memberInfos = members.map(name => ns.gang.getMemberInformation(name))
        memberInfos.forEach(memberInfo => {

            // Train until we have at least 30 in the stat, so mugging is at least kind of successful.
            const lowestStat = getLowestAscensionStat(memberInfo)
            if (lowestStat < 30) {
                pp(ns, `${memberInfo.name} lowest stat is ${lowestStat}, setting to Train.`)
                assignToTask(ns, memberInfo, trainingTask)
            } else {
                const crimeForRep = getCrimeForRep(memberInfo, isHackGang)
                pp(ns, `${memberInfo.name} lowest stat is ${lowestStat}, setting to ${crimeForRep}`)
                assignToTask(ns, memberInfo, crimeForRep)
            }
        })

        await ns.sleep(10 * 1000)

        members = ns.gang.getMemberNames()
    }
    pp(ns, 'We have at least 6 members, transitioning to long term growth strategy.', true)

    while (members.length < getMaxGangSize()) {

        const sortedMemberInfos = getSortedGangMemberInfos(ns, members, isHackGang)

        /*
        The ones with the highest values should be doing crime to get rep.
        The middle ones should doing either crime or wanted level removal.
        Everyone else should be training.
        A minimum of 1 person should be running rep crime.
        */
        let crimeForRep = getCrimeForRep(sortedMemberInfos[0], isHackGang)
        assignToTask(ns, sortedMemberInfos[0], crimeForRep)

        const numMembersForCrime = Math.ceil((members.length - 1) / 2)
        for (let i = 1; i < numMembersForCrime; i++) {

            // The gang info doesn't update instantly, so we need to delay slightly before our math works
            await ns.sleep(DELAY_AFTER_ASSIGNMENT)

            crimeForRep = getCrimeForRep(sortedMemberInfos[i], isHackGang)
            const task = getTargetCrimeOrWantedRemoval(ns, crimeForRep, wantedLevelRemovalCrime)
            assignToTask(ns, sortedMemberInfos[i], task)
        }

        for (let i = numMembersForCrime; i < members.length; i++) {
            ns.gang.setMemberTask(sortedMemberNames[i], trainingTask)
        }

        members = ns.gang.getMemberNames()
        await ns.sleep(30 * 1000)
    }

    pp(ns, `Max gang member count of ${getMaxGangSize()} acquired!`, true)

    // We have max gang. Time to get territory.
    // The top stat member is ALWAYS doing reputation gain.
    // Each other member trains until 2k in all combat stats.
    // Everyone above 2k in combat stats does Territory Warfare.
    // Once we have at least 2x the next highest gang's stats, start fighting.
    // Loop until we own everything
    let gangInfo = ns.gang.getGangInformation()
    while (gangInfo.territory < 1) {

        const sortedMemberInfos = getSortedGangMemberInfos(ns, members, isHackGang)

        let crimeForRep = getCrimeForRep(sortedMemberInfos[0], isHackGang)
        assignToTask(ns, sortedMemberInfos[0], crimeForRep)

        for (let i = 1; i < sortedMemberInfos.length; i++) {
            const memberInfo = sortedMemberInfos[i]

            if (getLowestAscensionStat(memberInfo, isHackGang) < 2000) {
                assignToTask(ns, memberInfo, trainingTask)
            } else {
                assignToTask(ns, memberInfo, 'Territory Warfare')
                await purchaseWarfareEquipment(ns, memberInfo.name)
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

            const chanceToWin = ns.gang.getChanceToWinClash(gangName)
            const otherIsStronger = chanceToWin < COMBAT_WIN_THRESHOLD
            if (otherIsStronger) {
                pp(ns, `We have a ${chanceToWin} chance to win against ${gangName}, which is below the threshold of ${COMBAT_WIN_THRESHOLD}`)
            }
            return otherIsStronger
        })) {
            ns.gang.setTerritoryWarfare(false)
        } else {
            if (!gangInfo.territoryWarfareEngaged) {
                pp(ns, "We're the strongest gang. WAAAAAAGH!", true)
                ns.gang.setTerritoryWarfare(true)
            }
        }

        await ns.sleep(30 * 1000)
        gangInfo = ns.gang.getGangInformation()
    }

    pp(ns, 'The world is ours! Max gang territory achieved!', true)

    // We own everything. Turn off territory combat and make money
    ns.gang.setTerritoryWarfare(false)

    const moneyCrime = getMoneyCrime(isHackGang)
    while (true) {

        const sortedMemberInfos = getSortedGangMemberInfos(ns, members, isHackGang)

        // The strongest should always make money.
        let memberInfo = sortedMemberInfos[0]
        assignToTask(ns, memberInfo, moneyCrime)

        let anyNotMakingMoney = false
        for (let i = 1; i < sortedMemberInfos.length; i++) {

            // The gang info doesn't update instantly, so we need to delay slightly before our math works
            await ns.sleep(DELAY_AFTER_ASSIGNMENT)

            memberInfo = sortedMemberInfos[i]

            let crime = getTargetCrimeOrWantedRemoval(ns, moneyCrime, wantedLevelRemovalCrime)
            let crimeForRep = getCrimeForRep(memberInfo, isHackGang)
            if (crime === crimeForRep && getLowestAscensionStat(memberInfo, isHackGang) < 7000) {
                crime = trainingTask
            } else {
                purchaseEquipment(ns, memberInfo, RELEVANT_EQUIPMENT)
            }

            if (crime !== moneyCrime) {
                anyNotMakingMoney = true
            }
            assignToTask(ns, memberInfo, crime)
        }

        if (anyNotMakingMoney) {
            await ns.sleep(30 * 1000)
        } else {
            pp(ns, "All gang members making money! Making sure everyone's geared up.", true)
            await purchaseAllEquipment(ns, sortedMemberInfos, RELEVANT_EQUIPMENT)
            pp(ns, "All gang members fully equipped! We're done!", true)
            ns.exit()
        }
    }
}