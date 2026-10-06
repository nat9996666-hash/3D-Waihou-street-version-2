# TTM Safety Challenge · live builds

Two games. Each has its own live Top 10. They can share one website.

| Game | Game file | Web address | Score service |
|---|---|---|---|
| Queen Street | `index.html` | `YOUR-SITE/` | `netlify/functions/scores.mjs` |
| Waihou Road | `waihou/index.html` | `YOUR-SITE/waihou/` | `netlify/functions/waihou-scores.mjs` |

Shared by both: `netlify.toml`, `package.json`, `package-lock.json`. These are the same in both upload folders, so it does not matter which game you upload first.

## Upload

1. Open the repository on GitHub.
2. **Add file → Upload files.**
3. Open the upload folder, select **everything inside it**, and drag it onto the GitHub page. Keep `netlify` and `waihou` as folders.
4. **Commit changes.** Netlify rebuilds by itself in a minute or two.

Both games in one repository is fine. Nothing from one game overwrites the other.

If Waihou Road is the only game in a repository, it also shows at the front page of that site.

Use GitHub, not Netlify drag-and-drop. Drag-and-drop puts the games up but leaves the scoreboards off.

## Check it worked (2 minutes per game)

1. Open the game. Tap **Admin**, type **1991**.
2. The first line should read **Live board connected.**
3. Play one run on one device. Open **Leaderboard** on a second device. The score should be there.
4. Back in Admin, **Clear the leaderboard** to wipe the test scores.

If the first line reads **Not connected**, the game still works, but each device keeps its own scores. To find out why, open the score service in a browser:

- Queen Street: `https://YOUR-SITE/.netlify/functions/scores`
- Waihou Road: `https://YOUR-SITE/.netlify/functions/waihou-scores`

It should say `"storage":"working"`. If it says "Page not found", that score service did not upload: check its file, `netlify.toml` and `package.json` are all in GitHub. If it says `"storage":"not working"`, copy the whole line and send it to whoever looks after the game.

## What players see

- **Play** and **Leaderboard**. Nothing else.
- Queen Street, during a run: the run badge and **Save & return**.
- Both games, before a setup or stage is picked: **Back to start**.

## What is behind Admin (code 1991)

Both games:

- Today's players and scores, **Remove** for one player, **Clear the leaderboard** for all.
- **Open projector scoreboard**: live Top 10 with a QR code to scan and play.
- **Removed from site count.**

Queen Street extras: Practice · untimed, Explore the map, Roundabout tour, Find Bear on site.

Waihou Road extras: Explore 3D, Vehicle studio, Police overkill, Chicken campaign demo, Legacy personal farm.

Extras lock again as soon as you go back to the start screen. Nothing typed into the web address can open them.

## Waihou Road: the chicken farm

A player who taps 10 chickens in the hazard round is shut down by the STMS, then walks to the chicken farm and can play it. That is how the game was built, and it is left on.

To keep the farm for admin only, open `waihou/index.html`, find this line near the top, and change `true` to `false`:

`const CHOOK_FARM_FOR_PLAYERS=true;`

With `false`, the STMS still shuts the player down, and they go to their results instead of the farm.

## Changing the admin code

Each game has it in two places. Keep each pair the same.

- Queen Street: `const ADMIN_CODE='1991';` in `index.html`, and `const ADMIN_CODE = process.env.ADMIN_CODE || '1991';` in `netlify/functions/scores.mjs`
- Waihou Road: the same two lines in `waihou/index.html` and `netlify/functions/waihou-scores.mjs`

## Where the data is kept

Netlify keeps one record per day, per game, in two stores: `queen-street-scores` and `waihou-road-scores`. You can see them in Netlify under the site's Blobs page. Each day has its own board, so tomorrow starts empty and today's record stays saved. Clearing a leaderboard keeps a copy first under `cleared/`.
