import type { Prisma, PrismaClient } from '@prisma/client';
import type { EngineEvent } from '../engine';
import { decryptJson, encryptJson } from './crypto';
import { log } from './logger';
import type { Room } from './rooms';

/**
 * Persistence for crash recovery and history.
 *
 * - The full room (including the hidden game state) is stored as an
 *   AES-256-GCM encrypted snapshot. Hidden data is never stored in plaintext
 *   columns, except RoleAssignment which is written once at game start and is
 *   needed for recaps/analytics after the game ends.
 * - Normalised rows (proposals, revealed votes, rounds) are written only once
 *   the information is public.
 * - QuestSubmission rows record WHO went on a quest, never which card they played.
 */
export interface Persistence {
  loadRooms(): Promise<Room[]>;
  saveRoom(room: Room, events: EngineEvent[]): void;
  deleteRoom(code: string): void;
}

export class MemoryPersistence implements Persistence {
  async loadRooms(): Promise<Room[]> {
    return [];
  }
  saveRoom(): void {}
  deleteRoom(): void {}
}

export class PrismaPersistence implements Persistence {
  private queues = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly key: string,
  ) {}

  async loadRooms(): Promise<Room[]> {
    const rows = await this.prisma.room.findMany({ where: { closedAt: null }, select: { encryptedSnapshot: true } });
    const rooms: Room[] = [];
    for (const r of rows) {
      try {
        rooms.push(decryptJson<Room>(r.encryptedSnapshot, this.key));
      } catch (e) {
        log.warn('Skipping unreadable room snapshot', { error: e });
      }
    }
    return rooms;
  }

  /** Writes are serialised per room so they land in order. */
  saveRoom(room: Room, events: EngineEvent[]): void {
    const snapshot = structuredClone(room);
    const prev = this.queues.get(room.code) ?? Promise.resolve();
    const next = prev
      .then(() => this.write(snapshot, events))
      .catch((e) => log.error('Persisting room failed', { room: room.code, error: e }));
    this.queues.set(room.code, next);
  }

  deleteRoom(code: string): void {
    void this.prisma.room.updateMany({ where: { code }, data: { closedAt: new Date() } }).catch(() => {});
  }

  private async write(room: Room, events: EngineEvent[]): Promise<void> {
    const encryptedSnapshot = encryptJson(room, this.key);
    await this.prisma.$transaction(async (tx) => {
      const dbRoom = await tx.room.upsert({
        where: { code: room.code },
        create: { code: room.code, hostPlayerId: room.hostId, settings: room.settings as unknown as Prisma.InputJsonValue, gameNumber: room.gameNumber, encryptedSnapshot },
        update: { hostPlayerId: room.hostId, settings: room.settings as unknown as Prisma.InputJsonValue, gameNumber: room.gameNumber, encryptedSnapshot },
      });

      for (const m of room.members) {
        await tx.player.upsert({
          where: { id: m.playerId },
          create: { id: m.playerId, roomId: dbRoom.id, name: m.name, avatar: m.avatar, isSpectator: m.isSpectator, ready: m.ready },
          update: { name: m.name, avatar: m.avatar, isSpectator: m.isSpectator, ready: m.ready, removedAt: null },
        });
        await tx.reconnectToken.upsert({
          where: { tokenHash: m.tokenHash },
          create: { playerId: m.playerId, tokenHash: m.tokenHash, expiresAt: new Date(Date.now() + 24 * 3600_000) },
          update: {},
        });
      }
      const ids = room.members.map((m) => m.playerId);
      await tx.player.updateMany({ where: { roomId: dbRoom.id, id: { notIn: ids }, removedAt: null }, data: { removedAt: new Date() } });
      await tx.reconnectToken.updateMany({ where: { player: { roomId: dbRoom.id }, playerId: { notIn: ids }, revokedAt: null }, data: { revokedAt: new Date() } });

      const g = room.game;
      if (!g) return;
      const game = await tx.game.upsert({
        where: { id: g.id },
        create: {
          id: g.id,
          roomId: dbRoom.id,
          number: room.gameNumber,
          phase: g.phase,
          version: g.version,
          configuration: {
            create: {
              optionalRoles: g.config.optionalRoles,
              assassinationTargets: g.config.assassinationTargets,
              revealRolesAtEnd: g.config.revealRolesAtEnd,
              playerCount: g.players.length,
            },
          },
          roleAssignments: { create: g.players.map((p, seat) => ({ playerId: p, roleId: g.roles[p]!, seat })) },
          rounds: { create: g.quests.map((q) => ({ questIndex: q.index, teamSize: q.size, failsRequired: q.failsRequired })) },
        },
        update: { phase: g.phase, version: g.version, winner: g.winner, winReason: g.winReason, endedAt: g.phase === 'GAME_OVER' ? new Date() : null },
      });

      const seqBase = await tx.gameEvent.count({ where: { gameId: game.id } });
      let seq = seqBase;
      for (const ev of events) {
        await tx.gameEvent.create({ data: { gameId: game.id, seq: seq++, type: ev.type, payload: ev as unknown as Prisma.InputJsonValue } });
        if (ev.type === 'VOTES_REVEALED') {
          const p = g.proposals.find((x) => x.id === ev.proposalId)!;
          const proposal = await tx.teamProposal.create({
            data: { gameId: game.id, proposalNumber: p.id, questIndex: p.questIndex, attempt: p.attempt, leaderId: p.leaderId, team: p.team, approved: p.approved },
          });
          await tx.vote.createMany({
            data: Object.entries(p.votes ?? {}).map(([playerId, approve]) => ({ proposalId: proposal.id, playerId, approve })),
          });
        }
        if (ev.type === 'QUEST_RESOLVED') {
          const q = g.quests[ev.questIndex]!;
          const round = await tx.round.update({
            where: { gameId_questIndex: { gameId: game.id, questIndex: q.index } },
            data: { result: q.result, successCount: q.successCount, failCount: q.failCount, revealedCards: q.revealedCards },
          });
          await tx.questSubmission.createMany({ data: q.team.map((playerId) => ({ roundId: round.id, playerId })) });
        }
      }
    });
  }
}
