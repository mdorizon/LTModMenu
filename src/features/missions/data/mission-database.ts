export interface MissionDef {
  title: string;
  requiredAmount: number;
  pointsReward: number;
  progressKey: string;
}

export const MISSION_DB: Record<string, MissionDef> = {
  // ── Daily ──
  "complete-2-pomodoros":         { title: "Complete 2 Pomodoros",              requiredAmount: 2,    pointsReward: 550,  progressKey: "pomodoro-complete" },
  "play-45-minutes":              { title: "Play for 45 minutes",              requiredAmount: 45,   pointsReward: 500,  progressKey: "play-minute" },
  "emote-5-times":                { title: "Emote 5 times",                    requiredAmount: 5,    pointsReward: 450,  progressKey: "emote" },
  "visit-friends-burrow":         { title: "Visit a friend's burrow",          requiredAmount: 1,    pointsReward: 450,  progressKey: "visit-friends-burrow" },
  "visit-3-town-burrows":         { title: "Visit 3 Burrows in the Town",      requiredAmount: 3,    pointsReward: 500,  progressKey: "visit-public-burrow" },
  "catch-10-fish":                { title: "Catch 10 fish",                    requiredAmount: 10,   pointsReward: 550,  progressKey: "catch-fish" },
  "sell-fish-for-200-coins":      { title: "Sell 200 coins worth of fish",     requiredAmount: 200,  pointsReward: 500,  progressKey: "sell-fish-for-coins" },
  "place-1-furniture":            { title: "Place 1 furniture in your Burrow", requiredAmount: 1,    pointsReward: 450,  progressKey: "place-furniture" },
  "complete-3-tasks":             { title: "Complete 3 tasks",                 requiredAmount: 3,    pointsReward: 500,  progressKey: "complete-task" },
  // ── Weekly ──
  "complete-15-pomodoros":        { title: "Complete 15 Pomodoros",             requiredAmount: 15,   pointsReward: 1550, progressKey: "pomodoro-complete" },
  "play-5-hours":                 { title: "Play for 5 hours",                 requiredAmount: 5,    pointsReward: 1500, progressKey: "play-hour" },
  "earn-2000-coins-from-fishing": { title: "Earn 2000 coins from fishing",     requiredAmount: 2000, pointsReward: 1600, progressKey: "sell-fish-for-coins" },
  "catch-legendary-fish":         { title: "Catch a legendary fish",           requiredAmount: 1,    pointsReward: 1500, progressKey: "catch-legendary-fish" },
  "catch-5-epic-fish":            { title: "Catch 5 epic fish",                requiredAmount: 5,    pointsReward: 1550, progressKey: "catch-epic-fish" },
};
