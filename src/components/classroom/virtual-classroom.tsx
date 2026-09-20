"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useTracks,
  useParticipants,
  useLocalParticipant,
  useConnectionState,
  useDataChannel,
  useIsSpeaking,
} from "@livekit/components-react";
import { ConnectionState, Track, type Participant } from "livekit-client";
import type { TrackReference } from "@livekit/components-core";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Hand,
  MessageSquare,
  Users,
  ScreenShare,
  ScreenShareOff,
  PhoneOff,
  Send,
  UserX,
  MessageSquareOff,
  AlertTriangle,
} from "lucide-react";
import {
  joinClassroomAction,
  leaveClassroomAction,
  toggleHandRaiseAction,
  sendChatMessageAction,
  fetchChatHistoryAction,
  muteStudentAction,
  removeStudentAction,
  lowerHandAction,
  toggleChatEnabledAction,
  endClassFromRoomAction,
} from "@/app/classroom/actions";

type Role = "teacher" | "student";

interface ChatMsg {
  id: string;
  body: string;
  senderName: string;
  createdAt: string;
}

interface DataMessage {
  type: "chat" | "hand-raise" | "chat-toggled";
  message?: ChatMsg;
  identity?: string;
  name?: string;
  raised?: boolean;
  enabled?: boolean;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function leaveBeacon(liveClassId: string) {
  try {
    navigator.sendBeacon("/api/classroom/leave", new Blob([JSON.stringify({ liveClassId })], { type: "application/json" }));
  } catch {
    // best-effort only
  }
}

export function VirtualClassroom({
  liveClassId,
  role,
  classTitle,
  subjectName,
}: {
  liveClassId: string;
  role: Role;
  classTitle: string;
  subjectName: string;
}) {
  const [state, setState] = useState<"connecting" | "ready" | "error">("connecting");
  const [connection, setConnection] = useState<{ token: string; wsUrl: string; identity: string; name: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    joinClassroomAction(liveClassId)
      .then((res) => {
        if (cancelled) return;
        setConnection(res);
        setState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : "Unable to join the classroom.");
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [liveClassId]);

  useEffect(() => {
    function onHide() {
      leaveBeacon(liveClassId);
    }
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      leaveBeacon(liveClassId);
    };
  }, [liveClassId]);

  if (state === "connecting") {
    return <FullScreenMessage title="Connecting to classroom..." subtitle="Setting up your audio and video connection." />;
  }
  if (state === "error" || !connection) {
    return <FullScreenMessage title="Unable to join class" subtitle={errorMessage ?? "Something went wrong."} icon={<AlertTriangle className="h-8 w-8 text-warning" />} />;
  }

  return (
    <LiveKitRoom token={connection.token} serverUrl={connection.wsUrl} connect audio={false} video={false} className="h-screen">
      <ClassroomRoom liveClassId={liveClassId} role={role} classTitle={classTitle} subjectName={subjectName} identity={connection.identity} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function FullScreenMessage({ title, subtitle, icon }: { title: string; subtitle: string; icon?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      {icon}
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="max-w-sm text-sm text-white/70">{subtitle}</p>
    </div>
  );
}

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  [ConnectionState.Connecting]: "Connecting",
  [ConnectionState.Connected]: "Connected",
  [ConnectionState.Reconnecting]: "Reconnecting...",
  [ConnectionState.Disconnected]: "Connection lost",
  [ConnectionState.SignalReconnecting]: "Reconnecting...",
};

function ClassroomRoom({
  liveClassId,
  role,
  classTitle,
  subjectName,
  identity,
}: {
  liveClassId: string;
  role: Role;
  classTitle: string;
  subjectName: string;
  identity: string;
}) {
  const router = useRouter();
  const connectionState = useConnectionState();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const screenShareTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });

  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [panel, setPanel] = useState<"none" | "chat" | "participants">("none");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [raisedHands, setRaisedHands] = useState<Map<string, string>>(new Map());
  const [chatEnabled, setChatEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { send: sendData } = useDataChannel((packet) => {
    try {
      const decoded = JSON.parse(decoder.decode(packet.payload)) as DataMessage;
      if (decoded.type === "chat" && decoded.message) {
        setMessages((prev) => (prev.some((m) => m.id === decoded.message!.id) ? prev : [...prev, decoded.message!]));
      } else if (decoded.type === "hand-raise" && decoded.identity) {
        setRaisedHands((prev) => {
          const next = new Map(prev);
          if (decoded.raised) next.set(decoded.identity!, decoded.name ?? decoded.identity!);
          else next.delete(decoded.identity!);
          return next;
        });
      } else if (decoded.type === "chat-toggled" && typeof decoded.enabled === "boolean") {
        setChatEnabled(decoded.enabled);
      }
    } catch {
      // ignore malformed payloads
    }
  });

  useEffect(() => {
    fetchChatHistoryAction(liveClassId).then(setMessages).catch(() => {});
  }, [liveClassId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, panel]);

  const broadcast = useCallback((data: DataMessage) => sendData(encoder.encode(JSON.stringify(data)), { reliable: true }), [sendData]);

  async function toggleMic() {
    try {
      await localParticipant.setMicrophoneEnabled(!micOn);
      setMicOn(!micOn);
      setMediaError(null);
    } catch {
      setMediaError("Microphone permission was denied. Check your browser settings.");
    }
  }

  async function toggleCam() {
    try {
      await localParticipant.setCameraEnabled(!camOn);
      setCamOn(!camOn);
      setMediaError(null);
    } catch {
      setMediaError("Camera permission was denied. Check your browser settings.");
    }
  }

  async function toggleScreenShare() {
    try {
      await localParticipant.setScreenShareEnabled(!sharingScreen);
      setSharingScreen(!sharingScreen);
    } catch {
      // user cancelled the share picker — not an error worth surfacing
    }
  }

  async function toggleHand() {
    const next = !handRaised;
    setHandRaised(next);
    await toggleHandRaiseAction(liveClassId, next);
    broadcast({ type: "hand-raise", identity, name: localParticipant.name || identity, raised: next });
  }

  async function handleSendChat(body: string) {
    const message = await sendChatMessageAction(liveClassId, body);
    setMessages((prev) => [...prev, message]);
    broadcast({ type: "chat", message });
  }

  async function handleLeave() {
    await leaveClassroomAction(liveClassId);
    router.push(role === "teacher" ? "/dashboard/online-learning/live-classes" : "/portal/student/online-learning/live-classes");
  }

  async function handleEndClass() {
    if (!confirm("End this live class for everyone?")) return;
    await endClassFromRoomAction(liveClassId);
    router.push(`/dashboard/online-learning/live-classes/${liveClassId}/attendance`);
  }

  async function handleMuteStudent(studentIdentity: string) {
    await muteStudentAction(liveClassId, studentIdentity);
  }

  async function handleRemoveStudent(studentIdentity: string) {
    if (!confirm("Remove this student from the class?")) return;
    await removeStudentAction(liveClassId, studentIdentity);
  }

  async function handleLowerHand(studentIdentity: string) {
    await lowerHandAction(liveClassId, studentIdentity);
    setRaisedHands((prev) => {
      const next = new Map(prev);
      next.delete(studentIdentity);
      return next;
    });
    broadcast({ type: "hand-raise", identity: studentIdentity, raised: false });
  }

  async function handleToggleChatEnabled() {
    const next = !chatEnabled;
    await toggleChatEnabledAction(liveClassId, next);
    setChatEnabled(next);
    broadcast({ type: "chat-toggled", enabled: next });
  }

  const teacher = participants.find((p) => p.attributes?.role === "teacher");
  const activeScreenShare = screenShareTracks[0];
  const teacherCameraTrack = cameraTracks.find((t) => t.participant.identity === teacher?.identity);
  const otherCameraTracks = cameraTracks.filter((t) => t.participant.identity !== teacher?.identity);
  const isConnected = connectionState === ConnectionState.Connected;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{classTitle}</p>
          <p className="truncate text-xs text-white/60">{subjectName}</p>
        </div>
        {connectionState !== ConnectionState.Connected && (
          <span className="shrink-0 rounded-full bg-warning/20 px-3 py-1 text-xs font-medium text-warning">{CONNECTION_LABEL[connectionState]}</span>
        )}
      </header>

      {mediaError && <div className="bg-danger/20 px-4 py-2 text-center text-xs text-danger">{mediaError}</div>}

      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <div className="relative flex min-h-0 flex-1 items-center justify-center rounded-lg bg-black/40">
            {activeScreenShare ? (
              <VideoTrack trackRef={activeScreenShare} className="h-full max-h-full w-full rounded-lg object-contain" />
            ) : teacherCameraTrack ? (
              <VideoTrack trackRef={teacherCameraTrack} className="h-full max-h-full w-full rounded-lg object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-white/50">
                <VideoOff className="h-10 w-10" />
                <p className="text-sm">Waiting for the teacher&apos;s video</p>
              </div>
            )}
          </div>

          {otherCameraTracks.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {otherCameraTracks.map((t) => (
                <VideoTile key={t.participant.identity} trackRef={t} />
              ))}
            </div>
          )}
        </main>

        {panel !== "none" && (
          <aside className="absolute inset-0 z-10 flex w-full flex-col border-l border-white/10 bg-[#12151c] sm:static sm:w-80 sm:shrink-0">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm font-semibold">{panel === "chat" ? "Class chat" : "Participants"}</p>
              <button onClick={() => setPanel("none")} className="text-xs text-white/60 hover:text-white">
                Close
              </button>
            </div>

            {panel === "chat" ? (
              <ChatPanel
                messages={messages}
                canSend={chatEnabled || role === "teacher"}
                chatEnabled={chatEnabled}
                isTeacher={role === "teacher"}
                onSend={handleSendChat}
                onToggleChat={handleToggleChatEnabled}
                chatEndRef={chatEndRef}
              />
            ) : (
              <ParticipantsPanel
                participants={participants}
                raisedHands={raisedHands}
                isTeacher={role === "teacher"}
                selfIdentity={identity}
                onMute={handleMuteStudent}
                onRemove={handleRemoveStudent}
                onLowerHand={handleLowerHand}
              />
            )}
          </aside>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 p-3">
        <ControlButton active={micOn} onClick={toggleMic} onIcon={<Mic className="h-5 w-5" />} offIcon={<MicOff className="h-5 w-5" />} label="Microphone" />
        <ControlButton active={camOn} onClick={toggleCam} onIcon={<VideoIcon className="h-5 w-5" />} offIcon={<VideoOff className="h-5 w-5" />} label="Camera" />
        {role === "teacher" && (
          <ControlButton
            active={sharingScreen}
            onClick={toggleScreenShare}
            onIcon={<ScreenShare className="h-5 w-5" />}
            offIcon={<ScreenShareOff className="h-5 w-5" />}
            label="Share screen"
          />
        )}
        {role === "student" && (
          <ControlButton active={handRaised} onClick={toggleHand} onIcon={<Hand className="h-5 w-5" />} offIcon={<Hand className="h-5 w-5" />} label="Raise hand" />
        )}
        <PanelButton
          active={panel === "chat"}
          onClick={() => setPanel(panel === "chat" ? "none" : "chat")}
          icon={<MessageSquare className="h-5 w-5" />}
          label="Chat"
          badge={panel !== "chat" ? messages.length : undefined}
        />
        <PanelButton
          active={panel === "participants"}
          onClick={() => setPanel(panel === "participants" ? "none" : "participants")}
          icon={<Users className="h-5 w-5" />}
          label={`Participants (${participants.length})`}
          badge={raisedHands.size > 0 ? raisedHands.size : undefined}
        />
        {role === "teacher" ? (
          <button onClick={handleEndClass} className="flex h-11 items-center gap-2 rounded-full bg-danger px-4 text-sm font-medium text-white hover:bg-danger/90">
            <PhoneOff className="h-5 w-5" /> End Class
          </button>
        ) : (
          <button onClick={handleLeave} className="flex h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium hover:bg-white/20">
            <PhoneOff className="h-5 w-5" /> Leave
          </button>
        )}
      </footer>
      {!isConnected && connectionState === ConnectionState.Reconnecting && (
        <div className="pointer-events-none absolute inset-x-0 top-14 flex justify-center">
          <span className="rounded-full bg-black/70 px-3 py-1 text-xs">Reconnecting...</span>
        </div>
      )}
    </div>
  );
}

function VideoTile({ trackRef }: { trackRef: TrackReference }) {
  const speaking = useIsSpeaking(trackRef.participant);
  const isTeacher = trackRef.participant.attributes?.role === "teacher";
  return (
    <div className={`relative h-24 w-32 shrink-0 overflow-hidden rounded-md bg-black/40 sm:h-28 sm:w-40 ${speaking ? "ring-2 ring-accent" : ""}`}>
      <VideoTrack trackRef={trackRef} className="h-full w-full object-cover" />
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px]">
        {trackRef.participant.name || trackRef.participant.identity}
        {isTeacher ? " (Teacher)" : ""}
      </span>
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  onIcon,
  offIcon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${active ? "bg-accent text-accent-foreground" : "bg-white/10 hover:bg-white/20"}`}
    >
      {active ? onIcon : offIcon}
    </button>
  );
}

function PanelButton({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`relative flex h-11 items-center gap-2 rounded-full px-4 text-sm transition-colors ${active ? "bg-accent text-accent-foreground" : "bg-white/10 hover:bg-white/20"}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {badge ? <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-semibold">{badge}</span> : null}
    </button>
  );
}

function ChatPanel({
  messages,
  canSend,
  chatEnabled,
  isTeacher,
  onSend,
  onToggleChat,
  chatEndRef,
}: {
  messages: ChatMsg[];
  canSend: boolean;
  chatEnabled: boolean;
  isTeacher: boolean;
  onSend: (body: string) => Promise<void>;
  onToggleChat: () => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft("");
    try {
      await onSend(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isTeacher && (
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-white/70">
          <span>Chat is {chatEnabled ? "enabled" : "disabled"} for students</span>
          <button onClick={onToggleChat} className="font-medium text-accent hover:underline">
            {chatEnabled ? "Disable" : "Enable"}
          </button>
        </div>
      )}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-white/50">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-sm">
              <p className="font-medium text-white/90">{m.senderName}</p>
              <p className="text-white/70">{m.body}</p>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          disabled={!canSend}
          placeholder={canSend ? "Type a message" : "Chat is disabled"}
          className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={!canSend || !draft.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ParticipantsPanel({
  participants,
  raisedHands,
  isTeacher,
  selfIdentity,
  onMute,
  onRemove,
  onLowerHand,
}: {
  participants: Participant[];
  raisedHands: Map<string, string>;
  isTeacher: boolean;
  selfIdentity: string;
  onMute: (identity: string) => void;
  onRemove: (identity: string) => void;
  onLowerHand: (identity: string) => void;
}) {
  return (
    <div className="flex-1 divide-y divide-white/10 overflow-y-auto">
      {participants.map((p) => {
        const role = p.attributes?.role === "teacher" ? "Teacher" : "Student";
        const handUp = raisedHands.has(p.identity);
        return (
          <div key={p.identity} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{p.name || p.identity}{p.identity === selfIdentity ? " (You)" : ""}</p>
              <p className="text-xs text-white/50">{role}</p>
            </div>
            <div className="flex items-center gap-2 text-white/60">
              {handUp && <Hand className="h-4 w-4 text-warning" />}
              {p.isMicrophoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              {p.isCameraEnabled ? <VideoIcon className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              {isTeacher && role === "Student" && (
                <>
                  {handUp && (
                    <button title="Lower hand" onClick={() => onLowerHand(p.identity)} className="text-white/60 hover:text-white">
                      <MessageSquareOff className="h-4 w-4" />
                    </button>
                  )}
                  <button title="Mute" onClick={() => onMute(p.identity)} className="text-white/60 hover:text-white">
                    <MicOff className="h-4 w-4" />
                  </button>
                  <button title="Remove" onClick={() => onRemove(p.identity)} className="text-danger hover:text-danger/80">
                    <UserX className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
