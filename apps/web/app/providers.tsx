"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "./types";
import { resolveAudioUrl, selectPlayableAudioKey } from "./types";

type PlayMode = "sequence" | "shuffle" | "repeat";

type PlayerState = {
  current: Track | null;
  playing: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  mode: PlayMode;
  error: string | null;
  play: (track: Track, queue?: Track[]) => Promise<void>;
  toggle: () => void;
  previous: () => void;
  next: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  cycleMode: () => void;
};

const PlayerContext = createContext<PlayerState | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<Track[]>([]);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, updateVolume] = useState(0.75);
  const [mode, setMode] = useState<PlayMode>("sequence");
  const [error, setError] = useState<string | null>(null);

  const stopLoading = useCallback(() => {
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = null;
    setLoading(false);
  }, []);

  const startLoading = useCallback(() => {
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    setLoading(true);
    loadingTimeoutRef.current = setTimeout(() => {
      audioRef.current?.pause();
      loadingTimeoutRef.current = null;
      setLoading(false);
      setError("音频载入超时，请重试");
    }, 15_000);
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = 0.75;
    audioRef.current = audio;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onLoadStart = () => startLoading();
    const onWaiting = () => startLoading();
    const onCanPlay = () => stopLoading();
    const onPlaying = () => { setPlaying(true); stopLoading(); };
    const onPause = () => { setPlaying(false); stopLoading(); };
    const onError = () => stopLoading();
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("loadstart", onLoadStart);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    return () => {
      audio.pause();
      stopLoading();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("loadstart", onLoadStart);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
    };
  }, [startLoading, stopLoading]);

  const play = useCallback(async (track: Track, queue?: Track[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (queue) queueRef.current = queue;
    setError(null);
    startLoading();
    try {
      if (current?.id !== track.id) {
        setCurrent(track);
        setCurrentTime(0);
        const key = selectPlayableAudioKey(track.audio, (mimeType) => audio.canPlayType(mimeType));
        audio.src = await resolveAudioUrl(key);
      }
      await audio.play();
      stopLoading();
    } catch (cause) {
      stopLoading();
      setError(cause instanceof Error ? cause.message : "无法播放音频");
    }
  }, [current, startLoading, stopLoading]);

  const changeBy = useCallback((step: number) => {
    if (!current || !queueRef.current.length) return;
    const queue = queueRef.current;
    const index = queue.findIndex((item) => item.id === current.id);
    const nextIndex = mode === "shuffle"
      ? Math.floor(Math.random() * queue.length)
      : (index + step + queue.length) % queue.length;
    void play(queue[nextIndex]);
  }, [current, mode, play]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      if (mode === "repeat") {
        audio.currentTime = 0;
        void audio.play();
      } else {
        changeBy(1);
      }
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [mode, changeBy]);

  const value = useMemo<PlayerState>(() => ({
    current,
    playing,
    loading,
    currentTime,
    duration,
    volume,
    mode,
    error,
    play,
    toggle: () => {
      const audio = audioRef.current;
      if (!audio || !current) return;
      if (audio.paused) {
        startLoading();
        void audio.play()
          .then(stopLoading)
          .catch((cause) => {
            stopLoading();
            setError(cause instanceof Error ? cause.message : "无法播放音频");
          });
      } else {
        audio.pause();
      }
    },
    previous: () => changeBy(-1),
    next: () => changeBy(1),
    seek: (time) => { if (audioRef.current) audioRef.current.currentTime = time; },
    setVolume: (nextVolume) => {
      updateVolume(nextVolume);
      if (audioRef.current) audioRef.current.volume = nextVolume;
    },
    cycleMode: () => setMode((value) => value === "sequence" ? "shuffle" : value === "shuffle" ? "repeat" : "sequence"),
  }), [current, playing, loading, currentTime, duration, volume, mode, error, play, changeBy, startLoading, stopLoading]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used inside PlayerProvider");
  return context;
}
