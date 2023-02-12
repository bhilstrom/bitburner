import { pp, runAndWaitFor } from './common.js'

async function join(ns) {
    await runAndWaitFor(ns, 'trainCombat.js')

    if (!ns.bladeburner.inBladeburner()) {
        ns.bladeburner.joinBladeburnerDivision()
    }
}

/** @param {import(".").NS } ns */
function getStaminaPercentage(ns) {
    const [current, max] = ns.bladeburner.getStamina();
    return current / max;
}

/** @param {import(".").NS } ns */
async function runAction(ns, type, name) {
    const blade = ns.bladeburner

    let time

    const currentAction = blade.getCurrentAction()
    if (currentAction.type == type && currentAction.name == name) {
        const fullTime = blade.getActionTime(type, name)
        time = fullTime - blade.getActionCurrentTime()
        pp(ns, `${type}.${name} is already running, no action taken`)
    } else {
        time = blade.getActionTime(type, name)
        if (!blade.startAction(type, name)) {
            throw new Error(`Failed to start bladeburner action ${type}.${name}`)
        }
        pp(ns, `Running ${type}.${name} for ${Math.ceil(time / 1000)} seconds`)
    }

    await ns.sleep(time)
}

/** @param {import(".").NS } ns */
async function spendSkillPoints(ns) {
    const blade = ns.bladeburner

    const desiredSkills = [
        "Blade's Intuition",
        "Short-Circuit",
        "Tracer",
        "Reaper",
        "Evasive System",
        "Hyperdrive"
    ]

    let available = blade.getSkillPoints()
    for (const skillName of desiredSkills) {
        while (blade.getSkillUpgradeCost(skillName) < available) {
            pp(ns, `Upgrading ${skillName}`)
            blade.upgradeSkill(skillName)
            available = blade.getSkillPoints()
            await ns.sleep(0)
        }
    }
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    [
        "sleep",
        "bladeburner.startAction"
    ].forEach(logName => ns.disableLog(logName))

    if (!ns.bladeburner.inBladeburner()) {
        await join(ns)
    }

    while (true) {

        const staminaPercentage = getStaminaPercentage(ns)

        let action = {
            type: 'Contract',
            name: 'Bounty Hunter',
        }

        // Avoid stamina penalty
        if (staminaPercentage <= 0.6) {
            pp(ns, `Stamina percentage is ${staminaPercentage}, regenerating`)
            action = {
                type: 'General',
                name: 'Hyperbolic Regeneration Chamber'
            }
        }

        await runAction(ns, action.type, action.name)

        await spendSkillPoints(ns)

        await ns.sleep(0)
    }
}