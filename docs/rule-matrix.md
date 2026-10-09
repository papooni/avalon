# Rule matrix

Every rule the engine enforces, where it lives in code, how it is tested, and the published source it was checked against. Rule IDs are referenced from `src/engine/rules.ts`.

Verification date: 2026-10-01.

## Sources

| ID | Source | Notes |
| --- | --- | --- |
| S1 | RulesPal transcription of *The Resistance: Avalon* rulebook, https://www.rulespal.com/resistance-avalon/rulebook | Closest available copy of the printed rulebook |
| S2 | RulesPal transcription of *Avalon: Big Box* rulebook, https://rulespal.com/avalon-big-box/rulebook | Later edition, same core rules |
| S3 | Dized official rules app: "Result of voting" and FAQ, https://rules.dized.com/the-resistance-avalon/rule/2-vote-on-team/result-of-voting , https://rules.dized.com/game/rZluqS52QmGdpoVxcmVLtg/faq | Publisher-licensed rules app |
| S4 | Wikipedia, "The Resistance (game)", https://en.wikipedia.org/wiki/The_Resistance_(game) | Team-size table and role summary |
| S5 | UltraBoardGames, Avalon rules, https://www.ultraboardgames.com/avalon/game-rules.php | Full tables |
| S6 | Hexagamers, setup by player count, https://hexagamers.com/avalon-setup-by-player-count/ | States it matches the printed tables |
| S7 | Octopus Overlords forum rules thread, https://www.octopusoverlords.com/forum/viewtopic.php?t=92409 | Community; used only for "Merlin sees Oberon", which S1/S2 also imply |
| S8 | avalon-game.com wiki, https://avalon-game.com/wiki/rules/ | Community quick-start |
| S9 | officialgamerules.org, https://officialgamerules.org/game-rules/the-resistance-avalon/ | Unofficial; **conflicts** on one rule (see C1) |

## Verified rules

| Rule | Behaviour | Code | Tests | Sources |
| --- | --- | --- | --- | --- |
| R-DIST-5..10 | 5: 3G/2E · 6: 4/2 · 7: 4/3 · 8: 5/3 · 9: 6/3 · 10: 6/4 | `PLAYER_COUNT_RULES` | rules.test "distribution" ×6, "dealt roles" ×6 | S5, S6 |
| R-QUEST-SIZE-5..10 | 5: 2,3,2,3,3 · 6: 2,3,4,3,4 · 7: 2,3,3,4,4 · 8–10: 3,4,4,5,5 | `PLAYER_COUNT_RULES` | rules.test | S4, S5, S6 |
| R-QUEST-FAIL-1 | A quest fails with one or more Fail cards | `resolveQuest` | engine.test "one Fail fails…" | S1, S5 |
| R-QUEST-FAIL-2 | With 7+ players, quest 4 (only) needs two Fails | `failsRequired` | engine.test "fourth quest" ×4 | S1, S4, S5, S6, S8 (conflict: C1) |
| R-QUEST-1 | Only team members play a card; once each | `validateCommand` | "players not on the team", "duplicate submissions" | S1, S5 |
| R-QUEST-2 | Good may only play Success; Evil may play either | `canFail` on role | "Good players cannot play Fail", "Evil may choose Success" | S5, S8 |
| R-QUEST-3 | Cards are shuffled before reveal; only totals are revealed | `resolveQuest` (author map dropped) | "cards are shuffled and authors dropped", projections.test | S1, S5 |
| R-LEAD-1 | First leader chosen at random | `startGame` | "initial leader is random" | S9 ("choose a player"); app uses crypto RNG per brief |
| R-LEAD-2 | Leadership passes to the next player after a rejection and after each quest | `rotateLeader` | "leadership rotates in seat order" | S1, S3 |
| R-VOTE-1 | The leader chooses exactly the quest's team size; may include themselves | `validateTeam` | "team must be exactly…" | S1 |
| R-VOTE-2 | Everyone votes, including leader and team | `resolveVotes` waits for all players | "votes hidden until everyone…" | S1, S2 |
| R-VOTE-3 | Votes revealed simultaneously | `pendingVotes` → `proposal.votes` at once | "votes are hidden until everyone has voted" | S3 |
| R-VOTE-4 | Strict majority approves; tie rejects | `approvals * 2 > total` | "3 of 5", "tie (3 of 6)" | S1, S3 (FAQ: "It is rejected") |
| R-VOTE-5 | Five consecutive rejections: Evil wins | `MAX_CONSECUTIVE_REJECTIONS` | "five consecutive rejections" | S1, S2, S3 (wording: C3) |
| R-VOTE-6 | Approval resets the rejection counter | `resolveVotes` | "an approval resets" | S2 ("in a single round") |
| R-WIN-1 | Three failed quests: Evil wins | `advance(ROUND_RESULT)` | "three failed quests" | S1, S2 |
| R-WIN-2 | Three successful quests: go to assassination | same | "three successful quests" | S1, S2 |
| R-ASN-1 | Assassin names one player; Merlin → Evil wins, otherwise Good | `ASSASSINATE` | "assassinating Merlin…", "anyone else…" | S2, S8 |
| R-ASN-2 | Only the Assassin may assassinate | `abilities: ['ASSASSINATE']` | "only the Assassin…" | S2 |
| R-ASN-3 | Target set (see C2) | `assassinationCandidates` | "may target Oberon" | Interpretation |
| R-ROLE-1 | Visible Evil roles see each other | sight rule `VISIBLE_TO_EVIL` | knowledge.test | S4, S5 |
| R-ROLE-2 | Merlin sees Evil except Mordred | `VISIBLE_TO_MERLIN` tag | knowledge.test | S4, S9 |
| R-ROLE-3 | Merlin does see Oberon | Oberon carries `VISIBLE_TO_MERLIN` | knowledge.test | S7; S3 FAQ addresses it |
| R-ROLE-4 | Percival sees Merlin and Morgana, indistinguishable | `MERLIN_CANDIDATE` → `MERLIN_OR_MORGANA` | knowledge.test, projections.test | S3 FAQ, S4 |
| R-ROLE-5 | Mordred hidden from Merlin | Mordred lacks `VISIBLE_TO_MERLIN` | knowledge.test | S4, S9 |
| R-ROLE-6 | Oberon does not see Evil and is not seen by Evil | Oberon lacks `VISIBLE_TO_EVIL`, `sees: []` | knowledge.test | S3 FAQ, S4, S9 |
| R-ROLE-7 | Merlin and Assassin are always present | `kind: 'REQUIRED'` | rules.test "dealt roles" | Project brief; S1 |

## Conflicts and interpretations

**C1: two-Fail rule on quest 5.** S9 says quests 4 *and* 5 need two Fails at 7+ players. S1 explicitly says "the 4th Quest (and only the 4th Quest)", and S4, S5, S6, S8 agree. Decision: quest 4 only, matching the rulebook transcription and the brief. The behaviour is a single data row (`failsRequired` in `src/engine/rules.ts`), so it can be changed without touching engine logic.

**C2: who the Assassin may target.** The brief says the Assassin "selects one Good player". The Assassin cannot know who is Good (Oberon is hidden from them), and restricting the choice to Good players would leak hidden information. Default `assassinationTargets: 'NOT_KNOWN_EVIL'`: any player except themselves and the Evil players they already know, which matches what they could do at a physical table. The host can switch to `'ANY_OTHER_PLAYER'`. Naming Oberon counts as a miss, so Good wins.

**C3: "five consecutive" vs "five in a single round".** S1/S2 phrase it as five rejected teams in a single round; the brief says five consecutive. These are equivalent because a round only ends with an approved team, which resets the counter. Implemented as a counter reset on approval.

**C4: optional variants not implemented.** S1 describes a "targeting" variant in which the leader also chooses which quest to attempt. S2 describes Lady of the Lake and Lancelot. None were requested; quests are played in order.

**C5: end-of-game role reveal.** Physical play ends with cards turned face up; the brief forbids sending all roles to clients. Default `revealRolesAtEnd: true`, applied only at `GAME_OVER`, and the host can turn it off. Quest-card authorship is never revealed, even at the end.

**C6: seat order.** At a physical table leadership follows seating. Online, the server randomises seat order once per game and leadership follows it. This is predictable and shown in the player list. A "host arranges seats" option would be a reasonable addition for in-person groups.
