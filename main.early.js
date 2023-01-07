import { getHackPrograms, getPlayerDetails, getItem, settings, pp } from './common.js'
import { getConnectionPath } from './findConnection.js'

/** @param {import(".").NS } ns */
async function trainHackingTo10(ns) {

    if (ns.getHackingLevel() >= 10) {
        pp(ns, 'Hack level is already 10 or above', true)
        return
    }

    pp(ns, `Hacking level less than 10, training up to 10 at university`, true)
    ns.singularity.universityCourse('Rothman University', 'Study Computer Science')

    while (ns.getHackingLevel() < 10) {
        await ns.sleep(1000)
    }
}

/** @param {import(".").NS } ns */
async function runAndWaitForSpider(ns) {
    ns.exec('spider.js', 'home', 1)
    while (ns.scriptRunning('spider.js', 'home')) {
        await ns.sleep(1000)
    }
}

/** @param {import(".").NS } ns */
function getHackProgramAndArgs(ns) {
    let result = {
        program: 'formulaHack.js',
        args: 'joesguns'
    }

    let ramRequiredForFormulaHack = ns.getScriptRam(result.program)
    ramRequiredForFormulaHack += settings().homeRamReserved

    // formulaHack requires at least one 'grow' instance to actually DO anything
    ramRequiredForFormulaHack += ns.getScriptExpGain('grow.batch.js')

    const homeServer = ns.getServer('home')
    const ramAvailable = homeServer.maxRam - homeServer.ramUsed
    if (ramAvailable < ramRequiredForFormulaHack) {

        pp(ns, `Only ${ramAvailable} RAM available, ${ramRequiredForFormulaHack} required to run formulaHack.js, running primaryHack.js instead`, true)
        result = {
            program: 'primaryHack.js',
            args: 'early'
        }
    }

    return result
}

/** @param {import(".").NS } ns */
async function startHackingOnJoesGuns(ns) {

    const programAndArgs = getHackProgramAndArgs(ns)

    if (ns.scriptRunning(programAndArgs.program, 'home')) {
        pp(ns, 'Hack script is already running', true)
        return
    }

    // Make sure joesguns is rooted
    await runAndWaitForSpider(ns)

    pp(ns, `Running ${programAndArgs.program}`, true)
    ns.exec(programAndArgs.program, 'home', 1, programAndArgs.args)
}

/** @param {import(".").NS } ns */
async function buyTorRouter(ns) {

    pp(ns, 'Waiting for TOR router purchase', true)
    while (!ns.singularity.purchaseTor()) {
        await ns.sleep(5000)
    }
    pp(ns, 'TOR router purchased', true)
}

/** @param {import(".").NS } ns */
async function getPortPrograms(ns, numPortsRequired) {

    let playerDetails = getPlayerDetails(ns)
    if (playerDetails.programs.length >= numPortsRequired) {
        return
    }

    pp(ns, `Waiting until we have at least ${numPortsRequired} port-opening programs (currently have ${playerDetails.programs.length})`, true)

    while (playerDetails.programs.length < numPortsRequired) {
        const missingPrograms = getHackPrograms()
            .filter(program => !playerDetails.programs.some(playerProgram => playerProgram.name == program.name))

        pp(ns, `Missing programs: ${JSON.stringify(missingPrograms, null, 2)}`, true)

        // This will return false if we couldn't purchase it.
        // Regardless of the outcome, we sleep and try again. Eventually, it works.
        ns.singularity.purchaseProgram(missingPrograms[0].name)

        await ns.sleep(1000)
        playerDetails = getPlayerDetails(ns)
    }
}

/** @param {import(".").NS } ns */
async function backdoorHost(ns, hostname) {
    const server = ns.getServer(hostname)
    if (server.backdoorInstalled) {
        pp(ns, `Backdoor already installed on ${hostname}`, true)
        return
    }

    let playerDetails = getPlayerDetails(ns)

    pp(ns, `Waiting until hacking level ${server.requiredHackingSkill} before installing backdoor on ${hostname}`, true)
    while (playerDetails.hackingLevel < server.requiredHackingSkill) {
        await ns.sleep(1000)
        playerDetails = getPlayerDetails(ns)
    }

    if (playerDetails.programs.length < server.numOpenPortsRequired) {
        await getPortPrograms(ns, server.numOpenPortsRequired)
    }

    // Spawn spider, which will take care of rooting the server
    await runAndWaitForSpider(ns)

    const serverMap = getItem(settings().keys.serverMap)

    // The 'backdoor' command only runs at the actual terminal, so we need to move our current connection there
    pp(ns, `Navigating to and installing backdoor on ${hostname}...`, true)
    const connectionPaths = getConnectionPath(ns, hostname, serverMap)
    connectionPaths.forEach(hostname => ns.singularity.connect(hostname))
    await ns.singularity.installBackdoor()
    ns.singularity.connect('home')
}

/** @param {import(".").NS } ns */
async function buyAllDarkwebPrograms(ns) {
    const allPrograms = ns.singularity.getDarkwebPrograms()
    for (let i = 0; i < allPrograms.length; i++) {
        const program = allPrograms[i]
        if (!ns.fileExists(program, 'home')) {
            pp(ns, `Purchasing ${program} from darkweb`)
            while (!ns.singularity.purchaseProgram(program)) {
                pp(ns, `... failed to purchase ${program}, waiting...`)
                await ns.sleep(30 * 1000)
            }
            pp(ns, `Purchased ${program}!`)
        }
    }
}

/** @param {import(".").NS } ns */
export async function main(ns) {

    [
        "sleep",
    ].forEach(logName => ns.disableLog(logName))

    await trainHackingTo10(ns)
    await startHackingOnJoesGuns(ns)
    await buyTorRouter(ns)

    const factionHosts = [
        'CSEC',
        'avmnite-02h',
        'I.I.I.I',
        'run4theh111z'
    ]

    for (let i = 0; i < factionHosts.length; i++) {
        const hostname = factionHosts[i]
        await backdoorHost(ns, hostname)

        // Once we've hacked The Black Hand, we should have enough money to buy the rest of the darkweb programs
        if (i == 2) {
            await buyAllDarkwebPrograms(ns)
        }
    }

    // Once we can backdoor run4theh111z, we definitely have enough machine to share.
    if (!ns.scriptRunning('share.js', 'home')) {
        ns.exec('share.js', 'home')
    }

    /* Script
    Sleeve thread:
    Shock recovery down to 5
    If no gang:
        Train skills up to homicide
        Murder until we can start a gang
    Else:
        Hack factions or university


    Faction thread:
    train hacking to 10
    shoplift until robbing a store has 100% success
    rob store
    (wait until CSEC)
    hacking CSEC

    Main thread:
    (wait until hacking 10)
    run spider, then formulaHack joesguns
    buy tor router
    buy BruteSSH
    run spider, restart formulaHack joesguns because of new servers available
    (wait until CSEC)
    backdoor CSEC
    join CSEC
    (wait until avm)
    backdoor avm
    join avm
    */
}