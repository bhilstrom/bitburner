import { pp } from './common.js'
import { getMaxGangSize, getTrainingTaskName } from './gang.common'

const DELAY_AFTER_ASSIGNMENT = 200
const COMBAT_WIN_THRESHOLD = .75
const COMBAT_EASY_THRESHOLD = .9

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
        let memberInfo = memberInfos[i]
        while (!purchaseEquipment(ns, memberInfo, equipmentToPurchase)) {
            await ns.sleep(30 * 1000)
            memberInfo = ns.gang.getMemberInformation(memberInfo.name)
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
    const moneyCrime = getMoneyCrime(isHackGang)
    const territoryWarfare = 'Territory Warfare'
    let members = ns.gang.getMemberNames()

    // Mug people until we have 6 members, because mugging is safe
    // and doable at low levels
    if (members.length < 6) {
        pp(ns, 'We have fewer than 6 members, setting everyone available to Mug until we have enough members.', true)
    }
    while (members.length < 6) {

        let memberInfos = members.map(name => ns.gang.getMemberInformation(name))
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

    // 10 members happens around stat level 550
    // 11 members happens around stat level 630
    // 12 members happens around stat level 1000+ (?)
    // Max gang size takes too long to start territory warfare productively.
    const desiredGangCount = 7
    while (members.length < desiredGangCount) {

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
            ns.gang.setMemberTask(sortedMemberInfos[i].name, trainingTask)
        }

        await ns.sleep(30 * 1000)
        members = ns.gang.getMemberNames()
    }

    pp(ns, `Gang member count of ${desiredGangCount} acquired. Starting first people on Territory Warfare`, true)

    // We have max gang. Time to get territory.
    // Once we have at least a 75% chance to win all fights, start fighting.
    // Once we have a >90% chance to win all fights, make money while taking some people off fighting.
    // Loop until we own everything
    let gangInfo = ns.gang.getGangInformation()
    while (gangInfo.territory < 1) {

        const otherGangInfo = ns.gang.getOtherGangInformation()
        let lowestChanceToWin = Number.MAX_SAFE_INTEGER
        Object.keys(otherGangInfo).forEach(gangName => {

            // Don't compare us against our own gang.
            if (gangName == gangInfo.faction) {
                return false
            }

            const otherGang = otherGangInfo[gangName]
            const chanceToWin = ns.gang.getChanceToWinClash(gangName)
            lowestChanceToWin = Math.min(lowestChanceToWin, chanceToWin)
        })
        pp(ns, `Lowest chance to win against another gang is ${lowestChanceToWin}`)

        const sortedMemberInfos = getSortedGangMemberInfos(ns, members, isHackGang)

        if (lowestChanceToWin < COMBAT_EASY_THRESHOLD) {
            // We need lots of people in territory warfare.
            // Top person does Territory Warfare, to start our numbers early.
            // Top person does reputation gain, to ensure we don't lose all our rep.
            // Everyone else:
            // 1. If we're not at max gang size and they're in the top half of indexes: rep gain.
            // 2. Else if under 2k stats: train
            // 3. Else: Territory Warfare
            let memberIndex = 0
            assignToTask(ns, sortedMemberInfos[memberIndex++], territoryWarfare)

            let crimeForRep = getCrimeForRep(memberIndex, isHackGang)
            assignToTask(ns, sortedMemberInfos[memberIndex++], crimeForRep)

            for (let i = memberIndex; i < sortedMemberInfos.length; i++) {
                const memberInfo = sortedMemberInfos[i]
                crimeForRep = getCrimeForRep(i, isHackGang)

                let task = territoryWarfare
                let isInTopHalf = i <= Math.floor(sortedMemberInfos.length / 2)
                if (sortedMemberInfos.length < getMaxGangSize() && isInTopHalf) {
                    task = crimeForRep
                } else if (getLowestAscensionStat(memberInfo, isHackGang) < 2000) {
                    task = trainingTask
                }

                assignToTask(ns, memberInfo, task)
            }
        } else {
            // We're winning easily. Work assignment is now as follows:
            // 1. Territory
            // 2-3. Rep
            // 3-4. Money
            // ?-? Negative rep fixing, if any needed
            // ?-12 Train
            let memberIndex = 0
            assignToTask(ns, sortedMemberInfos[memberIndex++], territoryWarfare)

            let crimeForRep = getCrimeForRep(sortedMemberInfos[memberIndex++], isHackGang)
            assignToTask(ns, sortedMemberInfos[memberIndex++], crimeForRep)

            crimeForRep = getCrimeForRep(sortedMemberInfos[memberIndex++], isHackGang)
            assignToTask(ns, sortedMemberInfos[memberIndex++], crimeForRep)

            assignToTask(ns, sortedMemberInfos[memberIndex++], moneyCrime)
            assignToTask(ns, sortedMemberInfos[memberIndex++], moneyCrime)

            // The gang info doesn't update instantly, so we need to delay slightly before our math works
            await ns.sleep(DELAY_AFTER_ASSIGNMENT)

            // Assign as many people to wanted level removal as is necessary
            let task = getTargetCrimeOrWantedRemoval(ns, trainingTask, wantedLevelRemovalCrime)
            let index = 4
            while (task !== trainingTask && index < sortedMemberInfos.length) {
                assignToTask(ns, sortedMemberInfos[index], task)
                index += 1
                await ns.sleep(DELAY_AFTER_ASSIGNMENT)
                task = getTargetCrimeOrWantedRemoval(ns, trainingTask, wantedLevelRemovalCrime)
            }

            // Everyone else trains
            for (let i = index; i < sortedMemberInfos.length; i++) {
                assignToTask(ns, sortedMemberInfos[i], trainingTask)
            }
        }

        // Combat should be ON if we're above the win threshold, OFF otherwise
        let shouldFight = lowestChanceToWin > COMBAT_WIN_THRESHOLD
        if (gangInfo.territoryWarfareEngaged !== shouldFight) {
            pp(ns, `Updating territory warface to '${shouldFight}'`, true)
            ns.gang.setTerritoryWarfare(shouldFight)
        }

        await ns.sleep(30 * 1000)
        gangInfo = ns.gang.getGangInformation()
    }

    pp(ns, 'The world is ours! Max gang territory achieved!', true)

    // We own everything. Turn off territory combat and make money
    ns.gang.setTerritoryWarfare(false)

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

            // Priority is as follows:
            // 1. Wanted level removal
            // 2. Training to 7k as lowest stat
            // 3. Make money
            let crime = getTargetCrimeOrWantedRemoval(ns, moneyCrime, wantedLevelRemovalCrime)
            if (crime === moneyCrime && getLowestAscensionStat(memberInfo, isHackGang) < 7000) {
                crime = trainingTask
            }

            // Anyone assigned to make money has their stats above 7k,
            // so we should buy them all the equipment to maximize profits.
            if (crime === moneyCrime) {
                purchaseEquipment(ns, memberInfo, RELEVANT_EQUIPMENT)
            } else {
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