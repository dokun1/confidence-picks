export default function AboutPage() {
  return (
    <div className='px-sm py-lg sm:p-lg'>
      <h1 className='text-2xl font-bold'>About</h1>
      <section className='mt-md space-y-md text-base text-gray-600'>
        <p>
          Confidence Picks is a sports pick&apos;em platform for groups of friends. Create or join a
          group, make your picks before each game locks, and climb your group&apos;s leaderboard.
          Each group runs one pool type, and the two pool types score differently — here&apos;s how
          points work in each.
        </p>

        <div className='space-y-xs'>
          <h2 className='text-lg font-semibold text-secondary-900 dark:text-neutral-0'>
            NFL confidence pools
          </h2>
          <p>
            Each week you rank that week&apos;s games by how confident you are. With N games on the
            slate, your surest pick is worth N points, the next is worth N−1, and so on down to 1.
            Get a pick right and you bank the points you assigned it; get it wrong and you lose that
            many points — a wrong pick subtracts its assigned value from your score. A tied game
            scores zero either way. Picks lock at kickoff, and scores accumulate across the season —
            rewarding consistent accuracy over lucky one-off calls.
          </p>
        </div>

        <div className='space-y-xs'>
          <h2 className='text-lg font-semibold text-secondary-900 dark:text-neutral-0'>
            World Cup pools
          </h2>
          <p>
            There&apos;s no confidence ranking — every match is worth a flat point value based only
            on the outcome you pick (home win, draw, or away win). Your tournament score is the sum
            across every match you picked.
          </p>
          <ul className='list-disc space-y-xxs pl-lg'>
            <li>
              <span className='font-medium text-secondary-900 dark:text-neutral-0'>Group stage:</span> pick the winning team
              → 3 points; pick a team that ends up drawing → 1; pick &ldquo;Draw&rdquo; and the match
              draws → 2; pick &ldquo;Draw&rdquo; but a team wins → 1; pick the losing team → 0.
            </li>
            <li>
              <span className='font-medium text-secondary-900 dark:text-neutral-0'>Knockout stage:</span> a match always
              produces a team that advances — extra time or a penalty shootout decides it — so there
              is no draw. Pick the advancing team → 3 points; pick anyone else → 0. The
              &ldquo;Draw&rdquo; option is disabled for knockout matches.
            </li>
          </ul>
        </div>

        <p>
          Whichever pool you&apos;re in, track the standings, see where you rank against your group,
          and chase the title to the final whistle.
        </p>
      </section>
    </div>
  );
}
