import "server-only";
import { AccessToken, EgressClient, EncodedFileOutput, RoomServiceClient, S3Upload, TrackSource, type VideoGrant } from "livekit-server-sdk";

/// Real-time video architecture (see ARCHITECTURE.md "Native live virtual
/// classroom"): LiveKit, an open-source SFU (Selective Forwarding Unit) —
/// every participant sends one media stream to the LiveKit server, which
/// forwards it to everyone else, rather than a mesh where every browser
/// sends video directly to every other browser. A mesh is fine for a 1:1
/// call but doesn't scale to a classroom of 30+ students; an SFU does.
///
/// This app's hosting (Vercel serverless functions, see
/// src/lib/db.ts's Prisma runtime-path fix) cannot itself run a persistent
/// media/signaling server — a serverless function can't hold a long-lived
/// WebRTC connection. So the actual media routing runs on a LiveKit server
/// (LiveKit Cloud, or a self-hosted LiveKit instance the school's own infra
/// team deploys — this app talks to either one identically via
/// LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET) while every other part of
/// the classroom experience — who is allowed to join, the UI, chat,
/// attendance, recordings metadata — is entirely Schoolum's own code. A
/// student or teacher never sees LiveKit's own UI, never creates a LiveKit
/// account, and is never redirected off Schoolum: the browser connects
/// directly to the media server using a short-lived token this app mints
/// server-side, entirely inside the Virtual Classroom page rendered by this
/// app's own design system.
///
/// Exactly like the OpenAI/Anthropic keys for the AI assistant (see
/// src/lib/ai/providers/registry.ts): no configured credentials means no
/// provider, and every caller here degrades to returning null rather than
/// faking a live session.
interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

function getConfig(): LiveKitConfig | null {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}

export function isLiveClassroomConfigured(): boolean {
  return getConfig() !== null;
}

/// The browser SDK needs the wss:// room URL; the server-side RoomServiceClient
/// needs an http(s) host for its REST calls — same LiveKit deployment, two
/// different schemes.
function toHttpUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws/i, "http");
}

let cachedRoomServiceClient: RoomServiceClient | null | undefined;
function getRoomServiceClient(): RoomServiceClient | null {
  const config = getConfig();
  if (!config) return null;
  if (cachedRoomServiceClient === undefined) {
    cachedRoomServiceClient = new RoomServiceClient(toHttpUrl(config.url), config.apiKey, config.apiSecret);
  }
  return cachedRoomServiceClient;
}

/// The browser connects to this — safe to send to an authorized client, it
/// carries no secret.
export function getLiveKitWsUrl(): string | null {
  return getConfig()?.url ?? null;
}

export interface ClassroomIdentity {
  userId: string;
  name: string;
  role: "teacher" | "student";
}

/// Mints a short-lived (4 hour) LiveKit access token scoped to exactly one
/// room and one already-authenticated, already-authorized Schoolum user.
/// This is the ONLY way a browser ever gets into a room — callers (the
/// classroom join route) must run the full join-eligibility check in
/// src/lib/services/live-classes.ts BEFORE calling this, never after.
/// roomAdmin is granted to the teacher alone, giving LiveKit's own server
/// additional moderator authority (mute/remove) that backs the app-level
/// teacher controls.
export async function mintClassroomToken(roomName: string, participant: ClassroomIdentity): Promise<string | null> {
  const config = getConfig();
  if (!config) return null;

  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    roomAdmin: participant.role === "teacher",
  };

  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: participant.userId,
    name: participant.name,
    ttl: "4h",
    attributes: { role: participant.role },
  });
  token.addGrant(grant);
  return token.toJwt();
}

/// Explicit room creation is optional with LiveKit (a room auto-creates on
/// first join) — calling this up front lets us cap maxParticipants and set
/// timeouts so an abandoned room doesn't linger. A no-op (not an error) when
/// LiveKit isn't configured or the room already exists.
export async function ensureClassroomRoom(roomName: string, maxParticipants?: number): Promise<void> {
  const client = getRoomServiceClient();
  if (!client) return;
  try {
    await client.createRoom({
      name: roomName,
      maxParticipants: maxParticipants ?? undefined,
      emptyTimeout: 30 * 60,
      departureTimeout: 10 * 60,
    });
  } catch {
    // Already exists, or LiveKit is briefly unreachable — the room still
    // auto-creates on first participant join either way.
  }
}

/// Disconnects every participant and tears down the room — called when a
/// teacher clicks "End Class", so nobody is left in a session that no
/// longer has a teacher.
export async function endClassroomRoom(roomName: string): Promise<void> {
  const client = getRoomServiceClient();
  if (!client) return;
  try {
    await client.deleteRoom(roomName);
  } catch {
    // Already ended or never created.
  }
}

/// Teacher control: "Remove Student". The student can technically request a
/// fresh join token again afterwards — the real access gate is
/// src/lib/services/live-classes.ts's join-eligibility check, which a
/// teacher can additionally back by cancelling/ending the class outright.
export async function removeParticipantFromRoom(roomName: string, identity: string): Promise<void> {
  const client = getRoomServiceClient();
  if (!client) return;
  try {
    await client.removeParticipant(roomName, identity);
  } catch {
    // Participant already left.
  }
}

/// Teacher control: "Mute Student". Server-enforced (not just a UI hint to
/// the student's own client) — LiveKit forces the track off; the student's
/// client only knows it happened via a track-muted event.
export async function forceMuteParticipantMicrophone(roomName: string, identity: string): Promise<boolean> {
  const client = getRoomServiceClient();
  if (!client) return false;
  try {
    const participant = await client.getParticipant(roomName, identity);
    const micTrack = participant.tracks.find((t) => t.source === TrackSource.MICROPHONE);
    if (!micTrack) return false;
    await client.mutePublishedTrack(roomName, identity, micTrack.sid, true);
    return true;
  } catch {
    return false;
  }
}

export async function listRoomParticipantIdentities(roomName: string): Promise<string[]> {
  const client = getRoomServiceClient();
  if (!client) return [];
  try {
    const participants = await client.listParticipants(roomName);
    return participants.map((p) => p.identity);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Recording (brief: "design the architecture to optionally support class
// recording"). LiveKit records via Egress, which writes its output to an
// S3-compatible bucket — a separate piece of infrastructure from Vercel
// Blob (src/lib/storage/blob.ts), which lecture/document uploads use.
// Recording is only ever offered when BOTH the classroom (LiveKit) and this
// bucket are configured; with either missing, isRecordingConfigured()
// returns false and the "Start recording" control simply doesn't appear —
// same honest degrade-when-unconfigured pattern as every other integration
// here, never a fake "recording" that produces nothing.
// ---------------------------------------------------------------------------

function getEgressS3Config(): S3Upload | null {
  const bucket = process.env.RECORDING_S3_BUCKET;
  const accessKey = process.env.RECORDING_S3_ACCESS_KEY;
  const secret = process.env.RECORDING_S3_SECRET_KEY;
  const region = process.env.RECORDING_S3_REGION;
  if (!bucket || !accessKey || !secret || !region) return null;
  return new S3Upload({ accessKey, secret, bucket, region });
}

export function isRecordingConfigured(): boolean {
  return isLiveClassroomConfigured() && getEgressS3Config() !== null;
}

let cachedEgressClient: EgressClient | null | undefined;
function getEgressClient(): EgressClient | null {
  const config = getConfig();
  if (!config) return null;
  if (cachedEgressClient === undefined) {
    cachedEgressClient = new EgressClient(toHttpUrl(config.url), config.apiKey, config.apiSecret);
  }
  return cachedEgressClient;
}

/// Returns the LiveKit egressId (stored on LiveClassRecording.storageKey) on
/// success, or null if recording isn't configured or the request failed —
/// callers must treat null as "recording did not start" and surface that
/// honestly rather than showing a misleading "recording" indicator.
export async function startRoomRecording(roomName: string, s3ObjectKey: string): Promise<string | null> {
  const client = getEgressClient();
  const s3 = getEgressS3Config();
  if (!client || !s3) return null;
  try {
    const output = new EncodedFileOutput({ filepath: s3ObjectKey, output: { case: "s3", value: s3 } });
    const info = await client.startRoomCompositeEgress(roomName, output);
    return info.egressId;
  } catch {
    return null;
  }
}

export async function stopRoomRecording(egressId: string): Promise<boolean> {
  const client = getEgressClient();
  if (!client) return false;
  try {
    await client.stopEgress(egressId);
    return true;
  } catch {
    return false;
  }
}
