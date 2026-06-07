"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";

export default function DriverSettingsPage() {
  return (
    <main className="min-h-screen flex items-start justify-center p-6">
      <div className="max-w-md w-full pt-8">
        <AuthLoading>
          <div className="text-sm text-slate-500">Loading…</div>
        </AuthLoading>
        <Unauthenticated>
          <div className="text-sm text-slate-400">
            Driver sign-in required.{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
            .
          </div>
        </Unauthenticated>
        <Authenticated>
          <Settings />
        </Authenticated>
      </div>
    </main>
  );
}

function Settings() {
  const me = useQuery(api.users.currentUser);
  const config = useQuery(api.driverConfig.get);
  if (me === undefined) return <div className="text-sm text-slate-500">Loading…</div>;
  if (!me) return null;
  if (me.role !== "driver" && me.role !== "admin") {
    return (
      <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-5 text-rose-200 text-sm">
        Not authorized.
      </div>
    );
  }
  if (!config) return <div className="text-sm text-slate-500">Loading…</div>;
  return <SettingsForm config={config} />;
}

function SettingsForm({
  config,
}: {
  config: {
    _id: string;
    driverName: string;
    driverPhone?: string;
    vehicle?: string;
    plate?: string;
    workDays: number[];
    workHoursStart: string;
    workHoursEnd: string;
    slotMinutes: number;
  };
}) {
  const updateConfig = useMutation(api.driverConfig.update);
  const blackouts = useQuery(api.blackouts.list);
  const createBlackout = useMutation(api.blackouts.create);
  const removeBlackout = useMutation(api.blackouts.remove);

  const [driverName, setDriverName] = useState(config.driverName);
  const [driverPhone, setDriverPhone] = useState(config.driverPhone ?? "");
  const [vehicle, setVehicle] = useState(config.vehicle ?? "");
  const [plate, setPlate] = useState(config.plate ?? "");
  const [workHoursStart, setWorkHoursStart] = useState(config.workHoursStart);
  const [workHoursEnd, setWorkHoursEnd] = useState(config.workHoursEnd);
  const [workDays, setWorkDays] = useState<number[]>(config.workDays);
  const [slotMinutes, setSlotMinutes] = useState(config.slotMinutes);

  const [blStart, setBlStart] = useState("");
  const [blEnd, setBlEnd] = useState("");
  const [blLabel, setBlLabel] = useState("");
  const [savedTick, setSavedTick] = useState(0);
  useEffect(() => {
    if (savedTick === 0) return;
    const id = setTimeout(() => setSavedTick(0), 1500);
    return () => clearTimeout(id);
  }, [savedTick]);

  async function save() {
    await updateConfig({
      driverName,
      driverPhone: driverPhone || undefined,
      vehicle: vehicle || undefined,
      plate: plate || undefined,
      workHoursStart,
      workHoursEnd,
      workDays,
      slotMinutes,
    });
    setSavedTick(Date.now());
  }

  function toggleDay(d: number) {
    setWorkDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  async function addBlackout() {
    if (!blStart || !blEnd) return alert("Pick a from and to time");
    const start = new Date(blStart).getTime();
    const end = new Date(blEnd).getTime();
    if (end <= start) return alert("End must be after start");
    await createBlackout({
      startAt: start,
      endAt: end,
      label: blLabel || undefined,
    });
    setBlStart("");
    setBlEnd("");
    setBlLabel("");
  }

  const days = [
    { n: "Sun", v: 0 },
    { n: "Mon", v: 1 },
    { n: "Tue", v: 2 },
    { n: "Wed", v: 3 },
    { n: "Thu", v: 4 },
    { n: "Fri", v: 5 },
    { n: "Sat", v: 6 },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <Link href="/driver" className="text-slate-400 text-sm">
          ← Driver dashboard
        </Link>
        <button
          onClick={save}
          className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-semibold"
        >
          {savedTick ? "✓ Saved" : "Save"}
        </button>
      </div>

      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <div className="text-sm font-medium">Profile (shown to clients)</div>
        <Field label="Name" value={driverName} onChange={setDriverName} />
        <Field
          label="Phone"
          value={driverPhone}
          onChange={setDriverPhone}
          placeholder="+592 ..."
          type="tel"
        />
        <Field
          label="Vehicle (make / model / color)"
          value={vehicle}
          onChange={setVehicle}
          placeholder="e.g. Toyota Corolla, silver"
        />
        <Field
          label="License plate"
          value={plate}
          onChange={setPlate}
          placeholder="e.g. ABC 1234"
        />
      </section>

      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 mt-3">
        <div className="text-sm font-medium mb-1">Working days</div>
        <div className="text-xs text-slate-400 mb-3">Tap to toggle.</div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const on = workDays.includes(d.v);
            return (
              <button
                key={d.v}
                onClick={() => toggleDay(d.v)}
                className={
                  "py-3 rounded-lg text-xs " +
                  (on
                    ? "bg-amber-500 text-slate-950 font-semibold"
                    : "bg-slate-800 text-slate-400")
                }
              >
                {d.n}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 mt-3">
        <div className="text-sm font-medium mb-1">Working hours</div>
        <div className="text-xs text-slate-400 mb-3">
          Outside these hours, clients can only schedule for later.
        </div>
        <div className="flex items-center gap-2">
          <label className="flex-1">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
              Start
            </div>
            <input
              type="time"
              value={workHoursStart}
              onChange={(e) => setWorkHoursStart(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </label>
          <div className="text-slate-500 mt-5">→</div>
          <label className="flex-1">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
              End
            </div>
            <input
              type="time"
              value={workHoursEnd}
              onChange={(e) => setWorkHoursEnd(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-[11px] uppercase tracking-wider text-slate-500">
            Slot length (min)
          </label>
          <input
            type="number"
            min={15}
            step={15}
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(Number(e.target.value) || 30)}
            className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
      </section>

      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 mt-3">
        <div className="text-sm font-medium mb-1">Block out time</div>
        <div className="text-xs text-slate-400 mb-3">
          Mark specific times unavailable — lunch, errands, prayer.
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="flex-1">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                From
              </div>
              <input
                type="datetime-local"
                value={blStart}
                onChange={(e) => setBlStart(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-xs"
              />
            </label>
            <label className="flex-1">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                To
              </div>
              <input
                type="datetime-local"
                value={blEnd}
                onChange={(e) => setBlEnd(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-xs"
              />
            </label>
          </div>
          <input
            value={blLabel}
            onChange={(e) => setBlLabel(e.target.value)}
            placeholder="Reason (optional) — e.g. lunch"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs"
          />
          <button
            onClick={addBlackout}
            className="w-full py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-semibold"
          >
            Block this time
          </button>
        </div>
        {blackouts && blackouts.length > 0 && (
          <div className="mt-3 space-y-1">
            {blackouts.map((b) => (
              <div
                key={b._id}
                className="flex items-center justify-between text-xs bg-slate-800 rounded-lg px-2 py-1.5"
              >
                <div>
                  <div className="text-slate-200">{b.label ?? "Blocked"}</div>
                  <div className="text-slate-500">
                    {new Date(b.startAt).toLocaleString()} →{" "}
                    {new Date(b.endAt).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => removeBlackout({ id: b._id })}
                  className="text-rose-400 text-lg leading-none px-2"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
      />
    </label>
  );
}
