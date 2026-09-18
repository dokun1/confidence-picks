// NFL scheduling is an Eastern-time concept: "today's slate" and "the morning
// after" both mean ET regardless of where the process runs. Every conversion
// goes through Intl with an explicit zone -- never the ambient process zone,
// which is UTC on Vercel and CI but whatever the developer's laptop says
// locally. A Sunday 8:20pm ET kickoff is Monday in UTC; bucketing it to Monday
// would split one slate across two days.
export const NFL_TIME_ZONE = 'America/New_York';

// en-CA renders as YYYY-MM-DD, which sorts and compares as a string.
const DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: NFL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// hourCycle 'h23' rather than hour12:false -- the latter renders midnight as
// "24" under some ICU builds.
const HOUR_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: NFL_TIME_ZONE,
  hour: '2-digit',
  hourCycle: 'h23',
});

/** 'YYYY-MM-DD' for the Eastern calendar day containing `date`. */
export function etDateKey(date) {
  return DATE_FMT.format(date instanceof Date ? date : new Date(date));
}

/** 0-23, the Eastern hour containing `date`. */
export function etHour(date) {
  return Number(HOUR_FMT.format(date instanceof Date ? date : new Date(date)));
}
