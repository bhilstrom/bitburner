const CITIES = ["Aevum", "Chongqing", "New Tokyo", "Ishima", "Volhaven", "Sector-12"];

const AGRICULTURE_NAME = "Ag"
const TOBACCO_NAME = "Tob"

//Buying coffee and throwing parties to those offices that needs them
/** @param {import(".").NS } ns */
async function coffeeParty(ns, division) {
    let c = ns.corporation
    for (const city of CITIES) {
        const office = c.getOffice(division, city)
        if (office.avgEne < 95) c.buyCoffee(division, city)
        if (office.avgHap < 95 || office.avgMor < 95) c.throwParty(division, city, 500_000)
    }
}

/** @param {import(".").NS } ns */
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

        await coffeeParty(c, AGRICULTURE_NAME)
        await coffeeParty(c, TOBACCO_NAME)
    }
}