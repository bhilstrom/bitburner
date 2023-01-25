/** @param {NS} ns */

const CITIES = ["Aevum", "Chongqing", "New Tokyo", "Ishima", "Volhaven", "Sector-12"];

const AGRICULTURE_NAME = "Ag"

//Buying coffee and throwing parties to those offices that needs them
async function coffeeParty(c) {
    for (const city of CITIES) {
        const office = c.getOffice(AGRICULTURE_NAME, city)
        if (office.avgEne < 95) c.buyCoffee(AGRICULTURE_NAME, city)
        if (office.avgHap < 95 || office.avgMor < 95) c.throwParty(AGRICULTURE_NAME, city, 500_000)
    }
}

export async function main(ns) {
    ns.tail(); ns.disableLog("ALL"); ns.clearLog();

    let c = ns.corporation

    while (true) {
        while (c.getCorporation().state != "EXPORT") {
			//when you make your main script, put things you want to be done 
			//potentially multiple times every cycle, like buying upgrades, here.
			await ns.sleep(0);
		}

		while (c.getCorporation().state == "EXPORT") {
			//same as above
			await ns.sleep(0);
		}

        await coffeeParty(c)
    }
}