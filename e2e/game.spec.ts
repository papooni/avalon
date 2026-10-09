import { expect, test } from '@playwright/test';
import { closeAll, continueAll, createTable, findLeader, isEvil, proposeTeam, readyAndStart, revealAll, runQuest, teamSize, voteAll } from './helpers';

test.describe.configure({ mode: 'serial' });

test('1. creating and joining a room', async ({ browser }) => {
  const { seats } = await createTable(browser, 3);
  for (const s of seats) {
    for (const other of seats) await expect(s.page.getByRole('listitem').filter({ hasText: new RegExp(`^${other.name}\\b`) })).toBeVisible();
  }
  await expect(seats[0]!.page.getByText('Waiting for 2 more players.').first()).toBeVisible();
  await closeAll(seats);
});

test('1b. a listed room appears on the home screen and can be joined', async ({ browser }) => {
  const { code, seats } = await createTable(browser, 1);
  const host = seats[0]!;
  await host.page.getByRole('switch', { name: /List on the home screen/ }).click();
  await expect(host.page.getByRole('switch', { name: /List on the home screen/ })).toBeChecked();

  const context = await browser.newContext();
  const visitor = await context.newPage();
  await visitor.goto('/');
  await visitor.getByRole('link', { name: `Join ${host.name}’s table` }).click();
  await expect(visitor.getByTestId('code-input')).toHaveValue(code);
  await visitor.getByTestId('name-input').fill('Visitor');
  await visitor.getByTestId('submit').click();
  await expect(visitor.getByTestId('room-code')).toHaveText(code);
  await expect(host.page.getByRole('listitem').filter({ hasText: /^Visitor\b/ })).toBeVisible();
  await context.close();
  await closeAll(seats);
});

test('2. starting a five-player game', async ({ browser }) => {
  const { seats } = await createTable(browser, 5);
  await expect(seats[0]!.page.getByTestId('start-game')).toBeDisabled();
  await readyAndStart(seats);
  await revealAll(seats);
  expect(seats.filter(isEvil)).toHaveLength(2);
  expect(seats.filter((s) => s.role === 'Merlin')).toHaveLength(1);
  expect(seats.filter((s) => s.role === 'Assassin')).toHaveLength(1);
  await closeAll(seats);
});

test('3. completing a successful team vote', async ({ browser }) => {
  const { seats } = await createTable(browser, 5);
  await readyAndStart(seats);
  await revealAll(seats);
  const size = await teamSize(seats);
  await proposeTeam(seats, seats.slice(0, size));
  await voteAll(seats, 3);
  await expect(seats[1]!.page.getByText('The team was approved, 3 to 2.')).toBeVisible();
  await closeAll(seats);
});

test('4. rejecting a proposal passes leadership', async ({ browser }) => {
  const { seats } = await createTable(browser, 5);
  await readyAndStart(seats);
  await revealAll(seats);
  const first = await findLeader(seats);
  const size = await teamSize(seats);
  await proposeTeam(seats, seats.slice(0, size));
  await voteAll(seats, 2);
  await expect(seats[0]!.page.getByText('The team was rejected, 2 to 3.')).toBeVisible();
  await continueAll(seats);
  const second = await findLeader(seats);
  expect(second.name).not.toBe(first.name);
  await expect(seats[0]!.page.getByLabel(/1 of 5 consecutive rejected teams/).first()).toBeVisible();
  await closeAll(seats);
});

test('5. resolving a successful quest', async ({ browser }) => {
  const { seats } = await createTable(browser, 5);
  await readyAndStart(seats);
  await revealAll(seats);
  await runQuest(seats, { fail: false });
  await expect(seats[0]!.page.getByLabel(/Quest 1: .*Succeeded/).first()).toBeAttached();
  await closeAll(seats);
});

test('6. resolving a failed quest, without revealing who failed it', async ({ browser }) => {
  const { seats } = await createTable(browser, 5);
  await readyAndStart(seats);
  await revealAll(seats);
  const good = seats.find((s) => !isEvil(s))!;
  await runQuest(seats, { fail: true });
  await expect(good.page.getByLabel(/Quest 1: .*Failed with 1 Fail/).first()).toBeAttached();
  await closeAll(seats);
});

test('7–8. reaching assassination; Good wins after a wrong guess', async ({ browser }) => {
  const { seats } = await createTable(browser, 5);
  await readyAndStart(seats);
  await revealAll(seats);
  for (let i = 0; i < 3; i++) await runQuest(seats, { fail: false });
  const assassin = seats.find((s) => s.role === 'Assassin')!;
  const goodNotMerlin = seats.find((s) => !isEvil(s) && s.role !== 'Merlin')!;
  await expect(seats[0]!.page.getByText(/Assassin must now identify Merlin|Choose who you believe is Merlin/).first()).toBeVisible();
  await assassin.page.getByRole('radio', { name: goodNotMerlin.name }).click();
  await assassin.page.getByTestId('assassinate').click();
  for (const s of seats) await expect(s.page.getByTestId('winner')).toHaveText('Good wins');
  await closeAll(seats);
});

test('9. Evil wins after identifying Merlin', async ({ browser }) => {
  const { seats } = await createTable(browser, 5);
  await readyAndStart(seats);
  await revealAll(seats);
  for (let i = 0; i < 3; i++) await runQuest(seats, { fail: false });
  const assassin = seats.find((s) => s.role === 'Assassin')!;
  const merlin = seats.find((s) => s.role === 'Merlin')!;
  await assassin.page.getByRole('radio', { name: merlin.name }).click();
  await assassin.page.getByTestId('assassinate').click();
  for (const s of seats) await expect(s.page.getByTestId('winner')).toHaveText('Evil wins');
  await closeAll(seats);
});

test('10. reconnecting restores the seat without leaking private information', async ({ browser }) => {
  const { seats } = await createTable(browser, 5);
  await readyAndStart(seats);
  await revealAll(seats);
  const target = seats[2]!;

  const frames: string[] = [];
  target.page.on('websocket', (ws) => ws.on('framereceived', (f) => typeof f.payload === 'string' && frames.push(f.payload)));
  await target.page.reload();

  // Seat restored: same player, same game, role still hidden behind the hold control.
  await expect(target.page.locator('#phase-headline')).toHaveText(/is choosing|You are the leader/);
  await expect(target.page.getByTestId('role-name')).toHaveCount(0);
  await target.page.getByRole('button', { name: 'My role' }).click();
  await target.page.getByTestId('privacy-ok').click();

  // Inspect every view received after reconnecting.
  const views = frames.filter((f) => f.includes('room:view'));
  expect(views.length).toBeGreaterThan(0);
  const myRoleId = { Merlin: 'MERLIN', Assassin: 'ASSASSIN', 'Minion of Evil': 'MINION', 'Loyal Servant': 'LOYAL_SERVANT' }[target.role!]!;
  for (const raw of views) {
    for (const id of ['MERLIN', 'ASSASSIN', 'MINION', 'LOYAL_SERVANT']) {
      if (id === myRoleId) continue;
      expect(raw.includes(`"${id}"`), `view leaked ${id}`).toBe(false);
    }
    expect(raw).not.toContain('pendingVotes');
    expect(raw).not.toContain('tokenHash');
  }
  // The DOM of a reconnected Loyal player must not contain anyone's role.
  if (!isEvil(target) && target.role !== 'Merlin') {
    const html = await target.page.content();
    for (const name of ['Assassin', 'Minion of Evil']) expect(html.includes(`>${name}<`)).toBe(false);
  }
  await closeAll(seats);
});
