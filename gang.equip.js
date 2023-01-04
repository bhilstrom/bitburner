import { pp } from './common.js'
import { getMaxGangSize, getTrainingTaskName } from './gang.common'

const equipment = [
    {
        name: 'Baseball Bat',
        mult: 2,
    },
    {
        name: ''
    }
]

async function equipGangMember(ns, memberName) {

}

/** @param {import(".").NS } ns */
export async function main(ns) {

    [
        "sleep",
    ].forEach(logName => ns.disableLog(logName))

    const isHackGang = ns.gang.getGangInformation().isHacking
    pp(ns, `Hack gang: ${isHackGang}`, true)

    while (true) {
        let members = ns.gang.getMemberNames()
        members.forEach(memberName => {
            equipGangMember(ns, members[i])
        })

        await ns.sleep(10000)
    }
}