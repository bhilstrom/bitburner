import { settings, getItem, pp } from './common.js'

const CORP_NAME = "MoneyMaker"
const AGRICULTURE_NAME = "Ag"
const TOBACCO_NAME = "Tob"

/** @param {import(".").NS } ns */
function getCities(ns) {
    let cityName = ns.enums.CityName
    return [
        cityName.Aevum,
        cityName.Chongqing,
        cityName.Ishima,
        cityName.NewTokyo,
        cityName.Sector12,
        cityName.Volhaven,
    ]
}

/** @param {import(".").NS } ns */
function needToCreateCorp(ns) {
    return !ns.corporation.hasCorporation()
}

/** @param {import(".").NS } ns */
function createCorp(ns) {
    let c = ns.corporation

    // Self-funding is better.
    // If that fails, self-fund.

    let created = false
    try {
        created = c.createCorporation(CORP_NAME, false)
        if (created) {
            pp(ns, "Created corp using self-funding", true)
        }
    } catch {
        // No-op. Outside of Bitnode 3, this is expected to fail.
    }

    if (!created) {
        c.createCorporation(CORP_NAME, true)
        pp(ns, "Created corp without self-funding", true)
    }
}

/** @param {import(".").NS } ns */
function needsAgriculture(ns) {
    return ns.corporation.getDivision(AGRICULTURE_NAME) === undefined
}

/** @param {import(".").NS } ns */
function createAgriculture(ns) {
    pp(ns, `Creating ${AGRICULTURE_NAME} division`, true)
    ns.corporation.expandIndustry("Agriculture", AGRICULTURE_NAME)
}

/** @param {import(".").NS } ns */
function coffeeParty(ns, division) {
    let c = ns.corporation
    const cities = getCities(ns)
    let anyNeeded = false
    for (const city of cities) {
        const office = c.getOffice(division, city)
        if (office.avgEne < 95) {
            anyNeeded = true
            c.buyCoffee(division, city)
        }

        if (office.avgHap < 95 || office.avgMor < 95) {
            anyNeeded = true
            c.throwParty(division, city, 500_000)
        }
    }

    return anyNeeded
}

/** @param {import(".").NS } ns */
function anyCityNeedsCoffeeOrParty(ns) {
    let c = ns.corporation

    const cities = getCities(ns)
    for (const city of cities) {
        for (const division of [AGRICULTURE_NAME, TOBACCO_NAME]) {
            const office = c.getOffice(division, city)

            const lowestStat = Math.min(office.avgEne, avgHap, avgMor)
            if (lowestStat < 95) {
                return true
            }
        }
    }

    return false
}

async function doNothing(ns) {
    // No-op. Waiting comes from the loop in which this is called.
}

/** @param {import(".").NS } ns */
async function runNextStep(ns, steps) {

    for (const step in steps) {
        // Only run one step at a a time.
        if (step.condition(ns)) {
            await step.action(ns)
            return false
        }
    }

    return true
}

/** @param {import(".").NS } ns */
function tobaccoNotAvailable(ns) {
    return ns.corporation.getDivision(TOBACCO_NAME) === undefined
}

/** @param {import(".").NS } ns */
function expandToTobacco(ns) {
    pp(ns, `Creating ${TOBACCO_NAME} division`, true)
    ns.corporation.expandIndustry("Tobacco", TOBACCO_NAME)
}

/** @param {import(".").NS } ns */
function needInvestorRound(ns, division, round) {
    return ns.corporation.getInvestmentOffer().round == round
}

/** @param {import(".").NS } ns */
async function getInvestorOffer(ns, division, round) {
    let c = ns.corporation

    pp(ns, `Starting to get investor offer...`)

    // Make sure we're at max stats
    while (coffeeParty(ns, division)) {
        pp(ns, `... maximizing stats`)
        await ns.sleep(200)
    }

    // Investor evaluation takes 5 cycles into account.
    // We want to use our current high stats, so wait for 5 cycles.
    const cycles = 5
    for (let i = 0; i < cycles; i++) {
        pp(ns, `... waiting for cycle (${i+1}/${cycles})`)
        await waitForCycle(ns)

        // Make sure our stats stay up
        coffeeParty(ns, division)
    }

    pp(ns, `Accepting offer at ${ns.nFormat(c.getInvestmentOffer().funds, "0.00a")}`)
    c.acceptInvestmentOffer()
}

/** @param {import(".").NS } ns */
async function expandToAllCities(ns, division) {
    getCities().forEach(city => {
        ns.corporation.expandCity(division, city)
    })
}

/** @param {import(".").NS } ns */
function notInAllCities(ns, division) {
    return ns.corporation.getDivision(division).cities.length < getCities().length
}

/** @param {import(".").NS } ns */
function needAdvert(ns, division, level) {
    return ns.corporation.getHireAdVertCount(division) < level
}

/** @param {import(".").NS } ns */
async function buyAdvert(ns, division, level) {
    let c = ns.corporation
    let currentCount = c.getHireAdVertCount(division)
    while (currentCount < level) {
        currentCount++
        pp(ns, `Buying AdVert in ${division}, level ${currentCount}`)
        c.hireAdVert(division)
        await ns.sleep(0)
    }
}

/** @param {import(".").NS } ns */
function needUnlockUpgrade(ns, upgrade) {
    return !ns.corporation.hasUnlockUpgrade(upgrade)
}

/** @param {import(".").NS } ns */
async function unlockUpgrade(ns, upgrade) {
    ns.corporation.unlockUpgrade(upgrade)
}

/** @param {import(".").NS } ns */
function needWarehouseLevel(ns, division, level) {
    for (const city of getCities(ns)) {
        if (!ns.corporation.hasWarehouse(division, city)) {
            return true
        }

        if (ns.corporation.getWarehouse(division, city).level < level) {
            return true
        }
    }

    return false
}

/** @param {import(".").NS } ns */
async function upgradeWarehouse(ns, division, level) {
    for (const city of getCities(ns)) {
        if (!ns.corporation.hasWarehouse(division, city)) {
            ns.corporation.purchaseWarehouse(division, city)
            ns.corporation.setSmartSupply(division, city)
        }

        await ns.sleep(0)

        // Purchase warehouse might not have gone through yet?
        const currentLevel = ns.corporation.getWarehouse(division, city).level || 1
        if (currentLevel < level) {
            ns.corporation.upgradeWarehouse(division, city)
        }
    }
}

function getJobTitles() {
    return [
        "Operations",
        "Engineer",
        "Business",
        "Management",
        "Research & Development",
    ]
}

/** @param {import(".").NS } ns */
function needToHireOrAssign(ns, division, desiredJobs) {
    for (const city of getCities(ns)) {
        const office = ns.corporation.getOffice(division, city)
        for (const job of getJobTitles()) {
            
            // != is correct, because we might have more people assigned than we should.
            if (office.employeeJobs[job] != desiredJobs[job]) {
                return true
            }
        }
    }

    return false
}

/** @param {import(".").NS } ns */
async function hireOrAssign(ns, division, desiredJobs) {
    for (const city of getCities(ns)) {
        const office = ns.corporation.getOffice(division, city)

        const totalJobs = Object.values(desiredJobs).reduce((partialSum, v) => partialSum + v)

        // Increase office size if necessary
        const reqsToOpen = totalJobs - office.size
        if (reqsToOpen > 0) {
            pp(ns, `Opening ${reqsToOpen} in ${division}.${city}`)
            ns.corporation.upgradeOfficeSize(division, city, reqsToOpen)
        }

        // Hire people if necessary
        while (ns.corporation.hireEmployee(division, city)) {
            pp(ns, `Hiring in ${division}.${city}`)
            await ns.sleep(0)
        }

        // Assign people to the appropriate job
        for (const job of getJobTitles()) {
            // If we don't list the job, assign 0 pepole to it
            const numWorkers = desiredJobs[job] || 0

            pp(ns, `Assigning ${numWorkers} to ${job} in ${division}.${city}`)
            ns.corporation.setAutoJobAssignment(division, city, job, numWorkers)
        }
    }
}

/** @param {import(".").NS } ns */
function needToSellMaterial(ns, division, sales) {
    let c = ns.corporation
    for (const city of getCities(ns)) {
        for (const material of Object.keys(sales)) {
            if (c.getMaterial(division, city, material).sCost != sales[material]) {
                return true
            }
        }
    }
}

/** @param {import(".").NS } ns */
async function sellMaterial(ns, division, sales) {
    let c = ns.corporation
    for (const city of getCities(ns)) {
        for (const material of Object.keys(sales)) {
            const amt = sales[material]
            pp(ns, `Selling ${material} for ${amt} in ${division}.${city}`)
            c.sellMaterial(division, city, material, "MAX", amt)
        }
    }
}

/** @param {import(".").NS } ns */
function needUpgrades(ns, upgrades) {
    for (const upgrade in Object.keys(upgrades)) {
        const desiredLevel = upgrades[upgrade]
        if (ns.corporation.getUpgradeLevel(upgrade) < desiredLevel) {
            return true
        }
    }
}

/** @param {import(".").NS } ns */
async function buyUpgrades(ns, upgrades) {
    let c = ns.corporation
    for (const upgrade in Object.keys(upgrades)) {
        const desiredLevel = upgrades[upgrade]
        let remaining = desiredLevel - c.getUpgradeLevel(upgrade)
        while (remaining > 0) {
            c.levelUpgrade(upgrade)
            remaining--
        }
    }
}

/** @param {import(".").NS } ns */
function needMaterials(ns, division, materials) {
    let c = ns.corporation
    for (const city of getCities(ns)) {
        for (const material of Object.keys(materials)) {
            if (c.getMaterial(division, city, material).qty < materials[material]) {
                return true
            }
        }
    }
}

/** @param {import(".").NS } ns */
async function setMaterials(ns, division, materials) {
    let c = ns.corporation

    // Create list of things to purchase
    const purchases = []
    for (const city of getCities(ns)) {
        for (const material of Object.keys(materials)) {
            const toBuy = materials[material] - c.getMaterial(division, city, material).qty
            if (toBuy > 0) {
                purchases.push({
                    city: city,
                    material: material,
                    amt: toBuy / 10, // Stupid divide-by-10 nonsense API
                })
            }
        }
    }

    // Only do it once per cycle
    await waitForCycle(ns)

    // Purchase
    purchases.forEach(purchase => {
        pp(ns, `Buying ${purchase.amt} ${purchase.material} in ${division}.${purchase.city}`)
        c.buyMaterial(division, purchase.city, purchase.material, purchase.amt)
    })

    // Wait for next cycle so we know we've purchased
    await waitForCycle(ns)

    // Set data to 0
    purchases.forEach(purchase => {
        pp(ns, `Zeroing out purchase of ${purchase.material} in ${division}.${purchase.city}`)
        c.buyMaterial(division, purchase.city, 0)
    })

    // Ensure the purchase went through so other calculations are correct
    await waitForCycle(ns)
}

/** @param {import(".").NS } ns */
async function waitForCycle(ns) {
    let c = ns.corporation

    // The actual state here doesn't matter.
    // What matters is that we trigger the action immediately after the state changes
    // out of the unique value.
    // This ensures it happens only once per cycle.
    const stateToCheck = "EXPORT"
    while (c.getCorporation().state != stateToCheck) {
        await ns.sleep(0)
    }
    while (c.getCorporation().state == stateToCheck) {
        await ns.sleep(0)
    }
}

/** @param {import(".").NS } ns */
export async function main(ns) {
    ns.disableLog("ALL")

    let c = ns.corporation

    if (needToCreateCorp(ns)) {
        createCorp(ns)
    }

    if (needsAgriculture(ns)) {
        createAgriculture(ns)
    }

    while (anyCityNeedsCoffeeOrParty(ns)) {
        coffeeParty(ns, AGRICULTURE_NAME)
        await ns.sleep(100)
    }

    /*
    Buy materials
    Get first investor offer
    Upgrades
    Buy materials
    Reassign employees
    Get second investor offer
    Buy materials
    Expand to Tobacco
    */

    const materialsToPurchase = [
    ]

    {
        ns.corporation.hireEmployee()
    }

    expandToAllCities(ns, AGRICULTURE_NAME)
    buyAdvert(ns, AGRICULTURE_NAME, 1)

    const steps = [
        {
            condition: needUnlockUpgrade,
            action: unlockUpgrade,
            args: ["Smart Supply"]
        },
        {
            condition: needWarehouseLevel,
            action: upgradeWarehouse,
            args: [AGRICULTURE_NAME, 1],
        },
        {
            condition: needToHireOrAssign,
            action: hireOrAssign,
            args: [AGRICULTURE_NAME, {
                Operations: 1,
                Engineer: 1,
                Business: 1
            }],
        },
        {
            condition: needToSellMaterial,
            action: sellMaterial,
            args: [AGRICULTURE_NAME, {
                Plants: "MP",
                Food: "MP"
            }]
        },
        {
            condition: needWarehouseLevel,
            action: upgradeWarehouse,
            args: [AGRICULTURE_NAME, 3],
        },
        {
            condition: needUpgrades,
            action: buyUpgrades,
            args: [{
                "Smart Factories": 2,
                "FocusWires": 2,
                "Neural Accelerators": 2,
                "Speech Processor Implants": 2,
                "Nuoptimal Nootropic Injector Implants": 2,
            }]
        },
        {
            condition: needMaterials,
            action: setMaterials,
            args: [AGRICULTURE_NAME, {
                "Hardware": 125,
                "AI Cores": 75,
                "Real Estate": 27_000,
            }],
        },
        {
            condition: needInvestorRound,
            action: getInvestorOffer,
            args: [AGRICULTURE_NAME, 1]
        },
        {
            condition: needToHireOrAssign,
            action: hireOrAssign,
            args: [AGRICULTURE_NAME, {
                Operations: 1,
                Engineer: 1,
                Business: 1,
                Management: 1,
                "Research & Development": 5,
            }],
        },
        {
            condition: needUpgrades,
            action: buyUpgrades,
            args: [{
                "Smart Factories": 10,
                "Smart Storage": 10,
            }]
        },
        {
            condition: needWarehouseLevel,
            action: upgradeWarehouse,
            args: [AGRICULTURE_NAME, 10],
        },
        {
            condition: needMaterials,
            action: setMaterials,
            args: [AGRICULTURE_NAME, {
                "Hardware": 2_800,
                "Robots": 96,
                "AI Cores": 2_520,
                "Real Estate": 146_400,
            }],
        },
        {
            condition: needToHireOrAssign,
            action: hireOrAssign,
            args: [AGRICULTURE_NAME, {
                Operations: 3,
                Engineer: 2,
                Business: 2,
                Management: 2,
            }],
        },
        {
            condition: needInvestorRound,
            action: getInvestorOffer,
            args: [AGRICULTURE_NAME, 2]
        },
        {
            condition: needWarehouseLevel,
            action: upgradeWarehouse,
            args: [AGRICULTURE_NAME, 19],
        },
        {
            condition: needMaterials,
            action: setMaterials,
            args: [AGRICULTURE_NAME, {
                "Hardware": 9_300,
                "Robots": 726,
                "AI Cores": 6_270,
                "Real Estate": 230_400,
            }],
        },
        {
            condition: tobaccoNotAvailable,
            action: expandToTobacco,
        }
    ]

    while (tobaccoNotAvailable(ns)) {
        coffeeParty(ns, AGRICULTURE_NAME)

        for (const step in steps) {
            const args = step.args || []
            if (step.condition(ns, ...args)) {
                await step.action(ns, ...args)
                break
            }
        }

        await ns.sleep(100)
    }
    
    pp(ns, `CORP START DONE, CHECK IT OUT!`, true)
}