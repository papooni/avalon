-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hostPlayerId" TEXT,
    "settings" JSONB NOT NULL,
    "gameNumber" INTEGER NOT NULL DEFAULT 0,
    "encryptedSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "isSpectator" BOOLEAN NOT NULL DEFAULT false,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerSession" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "socketId" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    CONSTRAINT "PlayerSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReconnectToken" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "ReconnectToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "winner" TEXT,
    "winReason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameConfiguration" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "optionalRoles" TEXT[],
    "assassinationTargets" TEXT NOT NULL,
    "revealRolesAtEnd" BOOLEAN NOT NULL,
    "playerCount" INTEGER NOT NULL,
    CONSTRAINT "GameConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "questIndex" INTEGER NOT NULL,
    "teamSize" INTEGER NOT NULL,
    "failsRequired" INTEGER NOT NULL,
    "result" TEXT,
    "successCount" INTEGER,
    "failCount" INTEGER,
    "revealedCards" TEXT[],
    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamProposal" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "proposalNumber" INTEGER NOT NULL,
    "questIndex" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL,
    "leaderId" TEXT NOT NULL,
    "team" TEXT[],
    "approved" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamProposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "approve" BOOLEAN NOT NULL,
    "revealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestSubmission" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameEvent" (
    "id" BIGSERIAL NOT NULL,
    "gameId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");
CREATE INDEX "Player_roomId_idx" ON "Player"("roomId");
CREATE INDEX "PlayerSession_playerId_idx" ON "PlayerSession"("playerId");
CREATE UNIQUE INDEX "ReconnectToken_tokenHash_key" ON "ReconnectToken"("tokenHash");
CREATE INDEX "ReconnectToken_playerId_idx" ON "ReconnectToken"("playerId");
CREATE UNIQUE INDEX "Game_roomId_number_key" ON "Game"("roomId", "number");
CREATE UNIQUE INDEX "GameConfiguration_gameId_key" ON "GameConfiguration"("gameId");
CREATE UNIQUE INDEX "RoleAssignment_gameId_playerId_key" ON "RoleAssignment"("gameId", "playerId");
CREATE UNIQUE INDEX "Round_gameId_questIndex_key" ON "Round"("gameId", "questIndex");
CREATE UNIQUE INDEX "TeamProposal_gameId_proposalNumber_key" ON "TeamProposal"("gameId", "proposalNumber");
CREATE UNIQUE INDEX "Vote_proposalId_playerId_key" ON "Vote"("proposalId", "playerId");
CREATE UNIQUE INDEX "QuestSubmission_roundId_playerId_key" ON "QuestSubmission"("roundId", "playerId");
CREATE UNIQUE INDEX "GameEvent_gameId_seq_key" ON "GameEvent"("gameId", "seq");

-- Foreign keys
ALTER TABLE "Player" ADD CONSTRAINT "Player_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerSession" ADD CONSTRAINT "PlayerSession_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconnectToken" ADD CONSTRAINT "ReconnectToken_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Game" ADD CONSTRAINT "Game_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameConfiguration" ADD CONSTRAINT "GameConfiguration_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Round" ADD CONSTRAINT "Round_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamProposal" ADD CONSTRAINT "TeamProposal_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "TeamProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestSubmission" ADD CONSTRAINT "QuestSubmission_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestSubmission" ADD CONSTRAINT "QuestSubmission_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
