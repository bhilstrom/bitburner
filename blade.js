import { pp, runAndWaitFor, msToS, getCities } from './common.js'

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
        pp(ns, `${type}.${name} is already running, ${msToS(time)} seconds remaining.`)
    } else {
        time = blade.getActionTime(type, name)
        if (!blade.startAction(type, name)) {
            throw new Error(`Failed to start bladeburner action ${type}.${name}`)
        }
        pp(ns, `Running ${type}.${name} for ${msToS(time, 0)} seconds`)
    }

    await ns.sleep(time)
}

/** @param {import(".").NS } ns */
async function spendSkillPoints(ns) {
    const blade = ns.bladeburner

    if (blade.getSkillPoints() <= 0) {
        return
    }

    const desiredSkills = [
        "Digital Observer",
        "Short-Circuit",
        "Reaper",
        "Evasive System",
        "Hyperdrive",
        "Blade's Intuition",
        "Tracer",
        "Overclock",
        "Cloak",
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

/**
 * @param {minChance} number
 * @param {maxChance} number
 * @returns {"VIABLE" | "NON-VIABLE" | "UNKNOWN"}
 */
function getChanceSpreadViability(minChance, maxChance) {

    const THRESHOLD = 0.75
    if (minChance > THRESHOLD) {
        return "VIABLE"
    }

    if (maxChance < THRESHOLD) {
        return "NON-VIABLE"
    }

    const spread = maxChance - minChance
    const spreadThreshold = 0.25
    if (spread > spreadThreshold) {
        // pp(ns, `${type}.${name} needs more info -- spread of ${spread} is too wide`)
        return "UNKNOWN"
    }

    if (minChance < (THRESHOLD - (spreadThreshold / 2) - .025)) {
        // pp(ns, `${type}.${name} needs more info -- min chance too low`)
        return "UNKNOWN"
    }

    const avg = (maxChance + minChance) / 2
    if (avg < THRESHOLD) {
        return "NON-VIABLE"
    }

    return "VIABLE"
}

/**
 * @param {import(".").NS } ns
 * @param {string} type
 * @param {string} name
 * @returns {Promise<number | "UNKNOWN">}
 */
async function modifyLevelToHighestAcceptable(ns, type, name) {
    const blade = ns.bladeburner

    for (let level = blade.getActionMaxLevel(type, name); level > 0; level--) {
        blade.setActionLevel(type, name, level)
        const [minChance, maxChance] = blade.getActionEstimatedSuccessChance(type, name)
        const viability = getChanceSpreadViability(minChance, maxChance)
        if (viability == "UNKNOWN") {
            return "UNKNOWN"
        }

        if (viability == "VIABLE") {
            return level
        }

        await ns.sleep(0)
    }

    return 0
}

/**
 * @param {import(".").NS } ns
 * @param {string} type
 * @param {string} name
 * @returns {"VIABLE" | "NON-VIABLE" | "UNKNOWN"}
 */
function isViableTarget(ns, type, name) {
    const blade = ns.bladeburner

    const [minChance, maxChance] = blade.getActionEstimatedSuccessChance(type, name)
    return getChanceSpreadViability(minChance, maxChance)
}

/** @param {import(".").NS } ns */
async function getTarget(ns) {
    const blade = ns.bladeburner

    const staminaPercentage = getStaminaPercentage(ns)

    // Avoid stamina penalty
    if (staminaPercentage <= 0.6) {
        pp(ns, `Stamina percentage is ${staminaPercentage}, regenerating`)
        return {
            type: 'General',
            name: 'Hyperbolic Regeneration Chamber',
        }
    }

    const city = blade.getCity()

    // Avoid chaos over 50
    const chaos = blade.getCityChaos(city)
    if (chaos > 50) {
        pp(ns, `Chaos level is ${chaos}, running Diplomacy`)
        return {
            type: "General",
            name: "Diplomacy",
        }
    }

    let options = [
        {
            type: "Operation",
            names: [
                "Assassination",
                "Stealth Retirement Operation",
            ]
        },
        {
            type: "Contract",
            names: [
                "Bounty Hunter",
                "Tracking",
            ]
        },
    ]
        .flatMap(option => {
            return option.names.map(name => {
                return {
                    type: option.type,
                    name: name,
                }
            })
        })

    for (const option of options) {
        option.level = await modifyLevelToHighestAcceptable(ns, option.type, option.name)
    }

    let needMoreInfo = false
    options = options.filter(option => {
        if (option.level == "UNKNOWN") {
            pp(ns, `${option.type}.${option.name} needs more info`)
            needMoreInfo = true
            return false
        }

        return option.level > 0
    })

    if (needMoreInfo) {
        // Override our available options with info-generating options.
        options = [
            {
                type: "Operation",
                name: "Undercover Operation",
            },
            {
                type: "Operation",
                name: "Investigation",
            },
            {
                type: "General",
                name: "Field Analysis",
            }
        ]
            .filter(option => isViableTarget(ns, option.type, option.name) == "VIABLE")
    }

    for (const option of options) {
        option.rep = blade.getActionRepGain(option.type, option.name)
        option.time = blade.getActionTime(option.type, option.name)
        option.repRatio = option.rep / option.time
    }

    options.sort((a, b) => b.repRatio - a.repRatio)

    const option = options[0]
    if (!option) {
        pp(ns, `No valid target. Training instead.`)
        return {
            type: "General",
            name: "Training",
        }
    }

    const openContracts = blade.getActionCountRemaining(option.type, option.name)
    if (openContracts <= 0) {
        pp(ns, `Cannot perform ${option.type}.${option.name}, not enough count.`)
        return {
            type: "General",
            name: "Incite Violence",
        }
    }

    return option
}

/** @param {import(".").NS } ns */
function maybeMoveCity(ns) {
    const blade = ns.bladeburner

    const currentCity = blade.getCity()
    if (blade.getCityEstimatedPopulation(currentCity) > 1_000_000_000) {
        return
    }

    const sortedCities = getCities(ns).map(cityName => {
        return {
            name: cityName,
            pop: blade.getCityEstimatedPopulation(cityName),
        }
    })
        .sort((a, b) => b.pop - a.pop)

    const highestPopCity = sortedCities[0].name
    if (highestPopCity == currentCity) {
        return
    }

    pp(ns, `Moving to ${highestPopCity}`)
    blade.switchCity(highestPopCity)
}

/** @param {import(".").NS } ns */
function turnOffAutoLevel(ns) {
    pp(ns, `Turning off AutoLevel for all Contracts and Operations`)
    const blade = ns.bladeburner

    const contracts = blade.getContractNames()
        .map(name => {
            return {
                type: "Contract",
                name: name,
            }
        })

    const operations = blade.getOperationNames()
        .map(name => {
            return {
                type: "Operation",
                name: name,
            }
        })

    for (const option of contracts.concat(operations)) {
        blade.setActionAutolevel(option.type, option.name, false)
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

    turnOffAutoLevel(ns)

    while (true) {

        let action = await getTarget(ns)

        await runAction(ns, action.type, action.name)

        maybeMoveCity(ns)

        await spendSkillPoints(ns)

        await ns.sleep(0)
    }
}