"use client";

import { useEffect, useState } from "react";

const STORAGE_PREFIX = "xunxian:daily-visitor:";
const RECORDED_PREFIX = "xunxian:daily-visitor-recorded:";
const VISIT_COUNT_EVENT = "xunxian:visit-count";
const VISITOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface VisitPayload {
  date: string;
  count: number;
}

function dateInShanghai() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function validPayload(value: unknown): value is VisitPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<VisitPayload>;
  return /^\d{4}-\d{2}-\d{2}$/.test(payload.date ?? "") && Number.isSafeInteger(payload.count) && (payload.count ?? -1) >= 0;
}

function dispatchCount(payload: VisitPayload) {
  window.dispatchEvent(new CustomEvent<VisitPayload>(VISIT_COUNT_EVENT, { detail: payload }));
}

export function VisitTracker() {
  useEffect(() => {
    const date = dateInShanghai();
    const storageKey = `${STORAGE_PREFIX}${date}`;
    const recordedKey = `${RECORDED_PREFIX}${date}`;
    let visitorId = window.localStorage.getItem(storageKey);
    if (!visitorId || !VISITOR_ID_PATTERN.test(visitorId)) {
      visitorId = crypto.randomUUID();
      window.localStorage.setItem(storageKey, visitorId);
    }

    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      const staleVisitor = key?.startsWith(STORAGE_PREFIX) && key !== storageKey;
      const staleRecorded = key?.startsWith(RECORDED_PREFIX) && key !== recordedKey;
      if (staleVisitor || staleRecorded) window.localStorage.removeItem(key as string);
    }

    if (window.localStorage.getItem(recordedKey) === "true") return;

    void fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId }),
      credentials: "same-origin",
    }).then(async (response) => {
      if (!response.ok) return;
      const payload: unknown = await response.json();
      if (validPayload(payload)) {
        window.localStorage.setItem(recordedKey, "true");
        dispatchCount(payload);
      }
    }).catch(() => undefined);
  }, []);

  return null;
}

export function DailyVisitStatus() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const receiveCount = (event: Event) => {
      const payload = (event as CustomEvent<VisitPayload>).detail;
      if (validPayload(payload)) setCount((current) => current === null ? payload.count : Math.max(current, payload.count));
    };
    window.addEventListener(VISIT_COUNT_EVENT, receiveCount);

    void fetch("/api/visits", { credentials: "same-origin" }).then(async (response) => {
      if (!response.ok) return;
      const payload: unknown = await response.json();
      if (validPayload(payload)) setCount((current) => current === null ? payload.count : Math.max(current, payload.count));
    }).catch(() => undefined);

    return () => window.removeEventListener(VISIT_COUNT_EVENT, receiveCount);
  }, []);

  return (
    <div className="status-cluster" aria-label={count === null ? "网站在线运行" : `网站在线运行，今日来访 ${count.toLocaleString("zh-CN")} 人次`}>
      <span className="local-badge"><span className="status-dot" />在线运行</span>
      {count !== null && <span className="daily-visit" aria-live="polite"><span>今日来访</span><strong>{count.toLocaleString("zh-CN")}</strong></span>}
    </div>
  );
}
