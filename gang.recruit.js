import { pp } from './common.js'
import {getTrainingTaskName} from './gang.common'

/** @param {import(".").NS } ns */
export async function main(ns) {

    const isHackGang = ns.gang.getGangInformation().isHacking
    const newRecruitTask = getTrainingTaskName(isHackGang)

    let members = ns.gang.getMemberNames()
    while (members.length < 12) {
        members = ns.gang.getMemberNames()
        if (ns.gang.canRecruitMember()) {
            const memberName = `Recruit-${members.length + 1}`
            ns.gang.recruitMember(memberName)
            pp(ns, `Recruited new member ${memberName}`, true)
            ns.gang.setMemberTask(memberName, newRecruitTask)
        }

        await ns.sleep(15000) // 15 seconds
    }

    pp(ns, 'All 12 gang members recruited!',  true)
}