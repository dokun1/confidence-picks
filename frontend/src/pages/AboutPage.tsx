export default function AboutPage() {
  return (
    <div className='p-lg'>
      <h1 className='text-2xl font-bold'>About</h1>
      <section className='mt-md space-y-md text-base text-gray-600'>
        <p>
          Confidence Picks is a weekly NFL confidence-picks pool for groups of
          friends. Each week, every member ranks that week&apos;s games by how
          confident they are in each outcome, assigning more points to the games
          they feel surest about.
        </p>
        <p>
          Picks lock at kickoff, so everyone commits before the action starts.
          Get a high-confidence pick right and you bank its full point value;
          get it wrong and you forfeit those points to the rest of the group.
        </p>
        <p>
          Scores accumulate across the season, rewarding consistent accuracy
          over lucky one-off calls. Track the standings, see where you rank
          against your group, and chase the title all the way to the Super Bowl.
        </p>
      </section>
    </div>
  );
}
