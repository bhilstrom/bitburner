import { pp } from './common.js'
import { getMaxGangSize, getTrainingTaskName } from './gang.common'

const DELAY_AFTER_ASSIGNMENT = 500
const COMBAT_WIN_THRESHOLD = .60
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
    if (getLowestAscensionStat(memberInfo) < 375) {
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
    
    // Generally, we should keep a low gain rate.
    // However, occasionally weirdness pops up due to delaying the assignments.
    // Because of that, we should also remove wanted level if the penalty ever gets above 5%.
    // GangInfo.wantedPenalty is given as a percentage multiplier, so ".95" is a 5% penalty.
    if (gangInfo.respectGainRate < (10000 * gangInfo.wantedLevelGainRate) || gangInfo.wantedPenalty < .95) {
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
        "gang.setMemberTask",
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

    // After 6 members, the amount of respect required means a lot of Mugging,
    // and all of the respect gained will be lost during ascensions.
    // Therefore, the fastest way to grow is to just straight up train everyone until they can do Terrorism,
    // and THEN go for rep.

    // Max gang size takes too long to start territory warfare productively.
    const desiredGangCount = 10
    while (members.length < desiredGangCount) {

        // Loop until the weakest person (of the top 6) can do Terrorism.
        // We do this inside the "desiredGangCount" loop so that when the script restarts,
        // we don't require the latest recruit to be at Terrorism levels before continuing.
        while (true) {
            const sortedMemberInfos = getSortedGangMemberInfos(ns, members, isHackGang).slice(0, 6)

            // Because we're getting the sorted member infos, the last person in the list is the weakest.
            const weakestMemberInfo = sortedMemberInfos[sortedMemberInfos.length - 1]
            const crimeForRep = getCrimeForRep(weakestMemberInfo, isHackGang)

            pp(ns, `Crime for rep of weakest is ${crimeForRep}`)
            if (crimeForRep === 'Terrorism') {
                break
            }

            // Everyone should be training.
            sortedMemberInfos.forEach(memberInfo => {
                assignToTask(ns, memberInfo, trainingTask)
            })

            await ns.sleep(10 * 1000)
            members = ns.gang.getMemberNames()
        }

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
        members = ns.gang.getMemberNames()

        const otherGangInfo = ns.gang.getOtherGangInformation()
        let lowestChanceToWin = Number.MAX_SAFE_INTEGER
        Object.keys(otherGangInfo).forEach(gangName => {

            // Don't compare us against our own gang.
            if (gangName == gangInfo.faction) {
                return false
            }

            const otherGang = otherGangInfo[gangName]

            // Don't compare us against gangs that can't fight anymore.
            if (otherGang.territory <= 0) {
                return false
            }

            const chanceToWin = ns.gang.getChanceToWinClash(gangName)
            lowestChanceToWin = Math.min(lowestChanceToWin, chanceToWin)
        })
        pp(ns, `Lowest chance to win against another gang is ${lowestChanceToWin}`)

        const sortedMemberInfos = getSortedGangMemberInfos(ns, members, isHackGang)

        // If we have been fighting, people might have died. If so, we need to recruit back to full.
        if (sortedMemberInfos.length < getMaxGangSize() && !ns.scriptRunning('gang.recruit.js', 'home')) {
            pp(ns, `We only have ${sortedMemberInfos.length} out of ${getMaxGangSize()} people, running recruit script.`)
            ns.exec('gang.recruit.js', 'home', 1)
        }

        if (lowestChanceToWin < COMBAT_EASY_THRESHOLD) {
            // We need lots of people in territory warfare.
            // Top 2 people do Territory Warfare, to start our numbers early.
            // Next top person does reputation gain, to ensure we don't lose all our rep.
            // Everyone else:
            // 1. If we're not at max gang size and they're in the top half of indexes: rep gain.
            // 2. Else if we need wanted level removal: remove wanted level
            // 2. Else if under 1500 stats: train
            // 3. Else: Territory Warfare
            let memberIndex = 0
            assignToTask(ns, sortedMemberInfos[memberIndex++], territoryWarfare)
            assignToTask(ns, sortedMemberInfos[memberIndex++], territoryWarfare)

            let crimeForRep = getCrimeForRep(memberIndex, isHackGang)
            assignToTask(ns, sortedMemberInfos[memberIndex++], crimeForRep)

            for (let i = memberIndex; i < sortedMemberInfos.length; i++) {
                await ns.sleep(DELAY_AFTER_ASSIGNMENT)

                const memberInfo = sortedMemberInfos[i]
                crimeForRep = getCrimeForRep(i, isHackGang)

                let task = territoryWarfare
                let isInTopHalf = i <= Math.floor(sortedMemberInfos.length / 2)
                if (sortedMemberInfos.length < getMaxGangSize() && isInTopHalf) {
                    task = getTargetCrimeOrWantedRemoval(ns, crimeForRep, wantedLevelRemovalCrime)
                } else if (getLowestAscensionStat(memberInfo, isHackGang) < 1500) {
                    task = trainingTask
                }

                assignToTask(ns, memberInfo, task)
            }
        } else {
            // We're winning easily. Work assignment is now as follows:
            // 1-2. Rep
            // 4-5. Money
            // ?-? Negative rep fixing, if any needed
            // ?-12 Train
            let memberIndex = 0

            let crimeForRep = getCrimeForRep(sortedMemberInfos[memberIndex], isHackGang)
            assignToTask(ns, sortedMemberInfos[memberIndex++], crimeForRep)

            crimeForRep = getCrimeForRep(sortedMemberInfos[memberIndex], isHackGang)
            assignToTask(ns, sortedMemberInfos[memberIndex++], crimeForRep)

            assignToTask(ns, sortedMemberInfos[memberIndex++], moneyCrime)
            assignToTask(ns, sortedMemberInfos[memberIndex++], moneyCrime)

            // The gang info doesn't update instantly, so we need to delay slightly before our math works
            await ns.sleep(DELAY_AFTER_ASSIGNMENT)

            // Assign as many people to wanted level removal as is necessary
            let task = getTargetCrimeOrWantedRemoval(ns, trainingTask, wantedLevelRemovalCrime)
            while (task !== trainingTask && memberIndex < sortedMemberInfos.length) {
                assignToTask(ns, sortedMemberInfos[memberIndex], task)
                await ns.sleep(DELAY_AFTER_ASSIGNMENT)
                task = getTargetCrimeOrWantedRemoval(ns, trainingTask, wantedLevelRemovalCrime)
                memberIndex++
            }

            // Everyone else trains
            while (memberIndex < sortedMemberInfos.length) {
                assignToTask(ns, sortedMemberInfos[memberIndex++], trainingTask)
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

        // If we have been fighting, people might have died. If so, we need to recruit back to full.
        if (sortedMemberInfos.length < getMaxGangSize() && !ns.scriptRunning('gang.recruit.js', 'home')) {
            ns.exec('gang.recruit.js', 'home', 1)
        }

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
            // 2. Training to 6k as lowest stat
            // 3. Make money
            let crime = getTargetCrimeOrWantedRemoval(ns, moneyCrime, wantedLevelRemovalCrime)
            if (crime === moneyCrime && getLowestAscensionStat(memberInfo, isHackGang) < 6000) {
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