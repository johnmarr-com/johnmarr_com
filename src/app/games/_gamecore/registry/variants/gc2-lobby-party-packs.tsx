"use client";

/**
 * GC2 Variant: Party Lobby with Packs
 *
 * Party-mode lobby: invite code, player list, AI invites, lobbyExtra
 * slot for pack picker + game length selector. Non-host sees waiting state.
 * For V1, the actual rendering is handled by GameMultiplayerFlow
 * inside composeGame — this registration provides metadata for the admin GUI.
 */

import { registerVariant } from "../registry";
import type { GC2Props } from "../types";

function GC2LobbyPartyPacks(_props: GC2Props) { // eslint-disable-line @typescript-eslint/no-unused-vars -- required by registerVariant interface
  // Rendering handled by composeGame via GameMultiplayerFlow.
  // This component is a placeholder for direct-use scenarios.
  return null;
}

registerVariant({
  id: "lobby-party-packs",
  slot: "gc2",
  label: "Party Lobby + Packs",
  description: "Invite players, pick content packs, set game length.",
  component: GC2LobbyPartyPacks,
});

export default GC2LobbyPartyPacks;
