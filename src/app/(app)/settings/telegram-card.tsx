"use client";
import { useEffect, useState, useTransition } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { disconnectTelegramAction, generateTelegramCodeAction, telegramStatusAction, updateNotifyPrefsAction } from "@/actions/account";

export function TelegramCard({ configured, linked, botUsername, notifyLimits, notifyReminders }: { configured: boolean; linked: boolean; botUsername: string; notifyLimits: boolean; notifyReminders: boolean }) {
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [isLinked, setLinked] = useState(linked);
  const [pending, start] = useTransition();

  // While a code is shown, check every 3 s whether the bot has received it.
  useEffect(() => {
    if (!code || isLinked) return;
    const t = setInterval(async () => { if ((await telegramStatusAction()).linked) { setLinked(true); setCode(null); } }, 3000);
    return () => clearInterval(t);
  }, [code, isLinked]);

  return (
    <Card className="mt-5 max-w-xl p-5">
      <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Telegram alerts</h2><Badge tone={isLinked ? "up" : "neutral"}>{isLinked ? "Connected" : "Not connected"}</Badge></div>
      <p className="mt-1 text-xs text-muted">Get a message when you reach your own daily limits, plus journal reminders. Messages describe your rules and records — never what to buy or sell.</p>
      {!configured && <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">Telegram isn&apos;t configured on this server (TELEGRAM_BOT_TOKEN is missing).</p>}
      {configured && !isLinked && (
        <div className="mt-4">
          {code ? (
            <div className="space-y-2 text-sm">
              <p>Open the bot and send this code (valid 15 minutes):</p>
              <p className="num rounded-lg border border-line bg-bg px-4 py-3 text-2xl font-semibold tracking-widest">{code}</p>
              {botUsername && <a href={`https://t.me/${botUsername}?start=${code}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">Open @{botUsername} in Telegram</a>}
            </div>
          ) : <Button disabled={pending} onClick={() => start(async () => { const r = await generateTelegramCodeAction(); if ("error" in r) setErr(r.error); else { setErr(""); setCode(r.code); } })}>Connect Telegram</Button>}
          {err && <p role="alert" className="mt-2 text-sm text-down">{err}</p>}
        </div>
      )}
      {isLinked && (
        <form action={updateNotifyPrefsAction} className="mt-4 space-y-3 text-sm">
          <label className="flex items-center gap-3"><input type="checkbox" name="notifyLimits" defaultChecked={notifyLimits} className="h-4 w-4 accent-blue-500" /> Alert me when I near or reach my limits</label>
          <label className="flex items-center gap-3"><input type="checkbox" name="notifyReminders" defaultChecked={notifyReminders} className="h-4 w-4 accent-blue-500" /> Journal reminders and weekly recap</label>
          <div className="flex gap-2"><Button size="sm">Save</Button><Button size="sm" variant="danger" type="button" onClick={() => start(async () => { await disconnectTelegramAction(); setLinked(false); })}>Disconnect</Button></div>
        </form>
      )}
    </Card>
  );
}
