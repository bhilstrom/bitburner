import { pp } from './common.js'

/** @param {import(".").NS } ns */
function maybeStartGang(ns) {

    if (ns.gang.inGang()) {
        return
    }

    const availableCombatFactions = [
        'Speakers for the Dead',
        'The Dark Army',
        'The Syndicate',
        'Slum Snakes',
    ]

    let factionForGang = undefined
    for (let i = 0; i < availableCombatFactions.length; i++) {
        const availableCombatFaction = availableCombatFactions[i]

        if (ns.singularity.checkFactionInvitations().includes(availableCombatFaction)) {
            ns.singularity.joinFaction(availableCombatFaction)
            factionForGang = availableCombatFaction
            break
        }

        if (ns.getPlayer().factions.includes(availableCombatFaction)) {
            factionForGang = availableCombatFaction
            break
        }
    }

    if (factionForGang === undefined) {
        throw new Error('Unable to find a combat faction to create a gang.')
    }

    ns.gang.createGang(factionForGang)
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    pp(ns, 'Starting gang management', true)

    maybeStartGang(ns)

    const scripts = [
        'gang.recruit.js',
        'gang.ascend.js',
        'gang.grow.js',
    ]

    scripts.forEach(script => {
        if (!ns.exec(script, 'home')) {
            throw new Error(`Failed to start gang script ${script}`)
        }
    })
}