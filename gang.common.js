/* Gang task names
[
    "Unassigned",
    "Mug People",
    "Deal Drugs",
    "Strongarm Civilians",
    "Run a Con",
    "Armed Robbery",
    "Traffick Illegal Arms",
    "Threaten & Blackmail",
    "Human Trafficking",
    "Terrorism",
    "Vigilante Justice",
    "Train Combat",
    "Train Hacking",
    "Train Charisma",
    "Territory Warfare"
]
*/

export function getMaxGangSize() {
    return 12
}

export function getTrainingTaskName(isHackGang) {
    return isHackGang ? 'Train Hacking' : 'Train Combat'
}