import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export interface Seat {
  name: string;
  page: Page;
  context: BrowserContext;
  role?: string;
}

const EVIL = ['Assassin', 'Minion of Evil', 'Morgana', 'Mordred', 'Oberon'];
export const isEvil = (s: Seat) => EVIL.includes(s.role ?? '');

/** Browser console errors (React warnings included) and uncaught exceptions; closeAll fails the test on any. */
const consoleErrors: string[] = [];

/** Creates a room in one context and joins the rest, each in its own browser context (separate storage). */
export async function createTable(browser: Browser, n: number): Promise<{ code: string; seats: Seat[] }> {
  const seats: Seat[] = [];
  for (let i = 0; i < n; i++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const name = `P${i + 1}`;
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(`${name}: ${m.text()}`));
    page.on('pageerror', (e) => consoleErrors.push(`${name}: ${e.message}`));
    seats.push({ name, context, page });
  }
  const host = seats[0]!;
  await host.page.goto('/create');
  await host.page.getByTestId('name-input').fill(host.name);
  await host.page.getByTestId('submit').click();
  const code = (await host.page.getByTestId('room-code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  for (const s of seats.slice(1)) {
    await s.page.goto(`/join?code=${code}`);
    await s.page.getByTestId('name-input').fill(s.name);
    await s.page.getByTestId('submit').click();
    await expect(s.page.getByTestId('room-code')).toHaveText(code);
  }
  return { code, seats };
}

export async function readyAndStart(seats: Seat[]) {
  for (const s of seats) await s.page.getByTestId('ready').click();
  const start = seats[0]!.page.getByTestId('start-game');
  await expect(start).toBeEnabled();
  await start.click();
}

/** Presses and holds the reveal control, returns the revealed text, then releases. */
export async function holdAndRead(page: Page, testId: string): Promise<string> {
  const hold = page.getByTestId('reveal-hold');
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const text = (await page.getByTestId(testId).textContent({ timeout: 3000 }))!.trim();
  await page.mouse.up();
  await expect(page.getByTestId(testId)).toHaveCount(0); // hidden immediately on release
  return text;
}

/** Every player privately reads their role and knowledge, then continues. */
export async function revealAll(seats: Seat[]) {
  for (const s of seats) {
    await s.page.getByTestId('privacy-ok').click();
    s.role = await holdAndRead(s.page, 'role-name');
    await s.page.getByTestId('reveal-continue').click();
  }
  for (const s of seats) {
    await s.page.getByTestId('privacy-ok').click();
    await holdAndRead(s.page, 'knowledge');
    await s.page.getByTestId('reveal-continue').click();
  }
  await expect(seats[0]!.page.locator('#phase-headline')).toHaveText(/is choosing|You are the leader/);
}

export async function findLeader(seats: Seat[]): Promise<Seat> {
  for (const s of seats) {
    if (await s.page.getByText(/^You are the leader\./).isVisible()) return s;
  }
  throw new Error('No leader found');
}

export async function proposeTeam(seats: Seat[], team: Seat[]) {
  const leader = await findLeader(seats);
  for (const m of team) {
    await leader.page.getByRole('checkbox', { name: new RegExp(`^${m.name}\\b`) }).click();
  }
  await leader.page.getByTestId('propose-team').click();
}

export async function voteAll(seats: Seat[], approveCount: number) {
  for (const [i, s] of seats.entries()) {
    await s.page.getByTestId(i < approveCount ? 'vote-approve' : 'vote-reject').click();
  }
}

/** Each player presses Continue on the current reveal. Waits for the button of the NEW phase to be enabled. */
export async function continueAll(seats: Seat[]) {
  for (const s of seats) {
    const btn = s.page.getByTestId('continue');
    await expect(btn).toBeEnabled();
    await btn.click();
  }
}

export async function teamSize(seats: Seat[]): Promise<number> {
  const leader = await findLeader(seats);
  const text = await leader.page.getByText(/^You are the leader\. Select \d+ players/).textContent();
  return Number(/Select (\d+)/.exec(text ?? '')![1]);
}

/** Proposes a team, approves it, plays the cards, and advances to the next round. */
export async function runQuest(seats: Seat[], opts: { fail: boolean }) {
  const size = await teamSize(seats);
  const good = seats.filter((s) => !isEvil(s));
  const evil = seats.filter(isEvil);
  const team = opts.fail ? [evil[0]!, ...good.slice(0, size - 1)] : good.slice(0, size);
  await proposeTeam(seats, team);
  await voteAll(seats, seats.length);
  await continueAll(seats);
  for (const m of team) {
    const failer = opts.fail && m === evil[0];
    await m.page.getByTestId(failer ? 'quest-fail' : 'quest-success').click();
  }
  await expect(seats[0]!.page.getByTestId('quest-result')).toHaveText(opts.fail ? 'Quest failed' : 'Quest succeeded');
  await continueAll(seats); // QUEST_REVEAL -> ROUND_RESULT
  await continueAll(seats); // ROUND_RESULT -> next
}

export async function closeAll(seats: Seat[]) {
  for (const s of seats) await s.context.close();
  expect(consoleErrors.splice(0)).toEqual([]);
}
