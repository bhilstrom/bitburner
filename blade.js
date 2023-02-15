import { pp, runAndWaitFor, msToS, getCities } from './common.js'

const POP_ESTIMATE_THRESHOLD = 1.5e9 // 1.5b

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

        // Sometimes the current action hasn't updated even after completing, in which case we get negative time
        time = Math.max(fullTime - blade.getActionCurrentTime(), 0)
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

    let available = blade.getSkillPoints()
    if (available <= 0) {
        return
    }

    const desiredSkills = {
        "Overclock": {
            max: 90,
        },
        "Hyperdrive": {},
        "Digital Observer": {},
        "Short-Circuit": {},
        "Reaper": {},
        "Evasive System": {},
        "Blade's Intuition": {},
        "Tracer": {
            max: 10,
        },
        "Cloak": {},
    }

    while (available > 0) {
        let anyPurchased = false
        for (const [name, data] of Object.entries(desiredSkills)) {
            if (data.max && !data.level) {
                data.level = blade.getSkillLevel(name)
            }

            if (data.max && data.max <= data.level) {
                continue
            }

            if (blade.getSkillUpgradeCost(name) > available) {
                continue
            }

            pp(ns, `Upgrading ${name}`)
            blade.upgradeSkill(name)
            available = blade.getSkillPoints()
            anyPurchased = true
            await ns.sleep(0)
        }

        if (!anyPurchased) {
            break
        }
    }
}

/**
 * @param {minChance} number
 * @param {maxChance} number
 * @returns {"VIABLE" | "NON-VIABLE" | "UNKNOWN"}
 */
function getChanceSpreadViability(minChance, maxChance, type = undefined) {

    const THRESHOLD = type == "BlackOp" ? 0.9 : 0.75
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
        const viability = getChanceSpreadViability(minChance, maxChance, type)
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
    return getChanceSpreadViability(minChance, maxChance, type)
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

    // If we have a high enough population, allow certain operations
    const targetCityPop = getTargetCity(ns).pop

    const stingThreshold = POP_ESTIMATE_THRESHOLD + 5e8 // + 500m
    if (targetCityPop > stingThreshold) {
        options[0].names.push("Sting Operation")
    }

    const stealthThreshold = POP_ESTIMATE_THRESHOLD + 1e9 // + 1bn
    if (targetCityPop > stealthThreshold) {
        options[0].names.push("Stealth Retirement Operation")
    }

    options = options.flatMap(option => {
        return option.names.map(name => {
            return {
                type: option.type,
                name: name,
            }
        })
    })

    const currentRank = blade.getRank()
    const blackOp = blade.getBlackOpNames()
        .map(name => {
            return {
                type: "BlackOp",
                name: name,
            }
        })
        .filter(option => blade.getBlackOpRank(option.name) < currentRank)
        .filter(option => blade.getActionCountRemaining(option.type, option.name) > 0)
        [0]

    if (blackOp) {
        options.push(blackOp)
    }

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

        return option.level > 0 // BlackOps have a level of 1 if we can do them
    })

    // pp(ns, `${JSON.stringify(options, null, 2)}`)

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
    
    // pp(ns, `options: ${JSON.stringify(options, null, 2)}`)

    let option

    // If a BlackOp is viable, use that.
    // There SHOULD be at most one BlackOp in the list.
    const firstBlackOp = options.find(option => option.type == "BlackOp")
    option = firstBlackOp ? firstBlackOp : options[0]
    // if (firstBlackOp) {
    //     option = firstBlackOp
    // } else {
    //     for (const option of options) {
    //         option.rep = blade.getActionRepGain(option.type, option.name)
    //         option.time = blade.getActionTime(option.type, option.name)
    //         option.repRatio = option.rep / option.time
    //     }
    
    //     options.sort((a, b) => b.repRatio - a.repRatio)
    //     option = options[0]
    //     pp(ns, JSON.stringify(options, null, 2))
    // }


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
function getCityNumbers(ns, cityName) {
    const blade = ns.bladeburner
    return {
        name: cityName,
        pop: blade.getCityEstimatedPopulation(cityName),
        chaos: blade.getCityChaos(cityName),
    }
}

function isPopulationHighEnough(cityNumbers) {
    // 1bn is needed, but we want a little buffer
    // due to estimates being wrong
    return cityNumbers.pop > POP_ESTIMATE_THRESHOLD
}

function isChaosLowEnough(cityNumbers) {
    return cityNumbers.chaos < 50
}

/** @param {import(".").NS } ns */
function getTargetCity(ns) {
    const blade = ns.bladeburner

    const currentCity = getCityNumbers(ns, blade.getCity())
    if (isPopulationHighEnough(currentCity) && isChaosLowEnough(currentCity)) {
        return currentCity
    }

    const cities = getCities(ns)
        .map(cityName => getCityNumbers(ns, cityName))
        .sort((a, b) => b.pop - a.pop)

    let targetCity = cities[0] // Default to the city with the highest population

    const citiesWithPopAndChaos = cities
        .filter(isPopulationHighEnough)
        .filter(isChaosLowEnough)
        .sort((a, b) => {
            // Sort by max population, then min chaos
            const popDiff = b.pop - a.pop
            return popDiff == 0 ? popDiff : a.chaos - b.chaos
        })

    if (citiesWithPopAndChaos.length) {
        targetCity = citiesWithPopAndChaos[0]
    }

    return targetCity
}

/** @param {import(".").NS } ns */
function maybeMoveCity(ns) {
    const blade = ns.bladeburner

    const currentCity = getCityNumbers(ns, blade.getCity())
    if (isPopulationHighEnough(currentCity) && isChaosLowEnough(currentCity)) {
        return
    }

    const targetCity = getTargetCity(ns)
    if (targetCity.name == currentCity.name) {
        return
    }

    pp(ns, `Moving to ${targetCity.name}`)
    blade.switchCity(targetCity.name)
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

        maybeMoveCity(ns)

        let action = await getTarget(ns)

        await runAction(ns, action.type, action.name)

        maybeMoveCity(ns)

        await spendSkillPoints(ns)

        await ns.sleep(0)
    }
}