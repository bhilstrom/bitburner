import { pp } from './common.js'
import { getMaxGangSize, getTrainingTaskName } from './gang.common'

function getMemberName(ns, memberNames) {
    const PREFIX = "Recruit-"

    let highestMemberNumber = 0
    memberNames.forEach(memberName => {
        const memberNumber = memberName.split('-')[1]
        highestMemberNumber = Math.max(highestMemberNumber, memberNumber)
    })

    return `${PREFIX}${highestMemberNumber + 1}`
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    [
        "sleep",
    ].forEach(logName => ns.disableLog(logName))

    const isHackGang = ns.gang.getGangInformation().isHacking
    const newRecruitTask = getTrainingTaskName(isHackGang)

    let members = ns.gang.getMemberNames()
    while (members.length < getMaxGangSize()) {
        if (ns.gang.canRecruitMember()) {
            const memberName = getMemberName(ns, members)
            if (!ns.gang.recruitMember(memberName)) {
                throw new Error(`Failed to recruit member ${memberName}`)
            }
            pp(ns, `Recruited new member ${memberName}`, true)
            ns.gang.setMemberTask(memberName, newRecruitTask)
        }

        members = ns.gang.getMemberNames()
        await ns.sleep(15000) // 15 seconds
    }

    pp(ns, `All ${getMaxGangSize()} gang members recruited!`, true)
}