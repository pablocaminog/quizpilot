import { useEffect, useRef, useState } from 'react';
import { WS_SERVER, WS_CLIENT } from '@/shared/protocol.js';

// Room WebSocket lifecycle with exponential backoff reconnect. The server
// sends a full role-appropriate `room_snapshot` on every (re)connect; UI
// renders purely from the latest snapshot plus streamed events.
export function useRoom(path, { onEvent, onUnauthorized } = {}) {
  const [snapshot, setSnapshot] = useState(null);
  const [room, setRoom] = useState(null);
  const [connected, setConnected] = useState(false);
  const [denied, setDenied] = useState(false);
  const ref = useRef({ ws: null, delay: 500, closed: false, onEvent });
  ref.current.onEvent = onEvent;

  useEffect(() => {
    const state = ref.current;
    state.closed = false;
    state.delay = 500;
    let ws;

    const connect = () => {
      if (state.closed) return;
      let opened = false;
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${path}`);
      state.ws = ws;
      ws.addEventListener('open', () => {
        opened = true;
        state.delay = 500;
        setConnected(true);
        setDenied(false);
      });
      ws.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        if (data.type === WS_SERVER.snapshot) {
          setSnapshot(data.snapshot);
          setRoom(data.snapshot);
        } else {
          setRoom((r) => (r ? mergeEvent(r, data) : r));
        }
        state.onEvent?.(data);
      });
      ws.addEventListener('close', () => {
        setConnected(false);
        if (state.closed) return;
        if (!opened) {
          setDenied(true);
          onUnauthorized?.();
          return;
        }
        setTimeout(connect, state.delay);
        state.delay = Math.min(state.delay * 2, 8000);
      });
      ws.addEventListener('error', () => {});
    };
    connect();
    return () => {
      state.closed = true;
      state.ws?.close();
    };
  }, [path]);

  const send = (message) => ref.current.ws?.readyState === WebSocket.OPEN && ref.current.ws.send(JSON.stringify(message));
  return { snapshot, room, connected, denied, send };
}

// Applies one broadcast event to the live room view between snapshots.
function mergeEvent(room, e) {
  switch (e.type) {
    case WS_SERVER.questionOpen:
      return {
        ...room,
        status: 'question_open',
        questionPosition: e.questionPosition,
        question: e.question,
        deadlineMs: e.deadlineMs,
        serverNowMs: e.serverNowMs,
        answeredCount: 0,
        results: null,
        correctIndex: null,
      };
    case WS_SERVER.answerCount:
      return { ...room, answeredCount: e.answered };
    case WS_SERVER.questionClosed:
      return {
        ...room,
        status: 'question_closed',
        correctIndex: e.correctIndex,
        results: e.results,
        leaderboard: e.leaderboard,
        players: e.leaderboard,
        deadlineMs: null,
        question: room.question ? { ...room.question, correctIndex: e.correctIndex } : room.question,
      };
    case WS_SERVER.gameFinished:
      return { ...room, status: 'finished', leaderboard: e.leaderboard, players: e.leaderboard, deadlineMs: null };
    case WS_SERVER.playerJoined:
      return room.players.some((p) => p.playerId === e.player.playerId)
        ? room
        : { ...room, players: [...room.players, { ...e.player, score: 0, totalElapsedMs: 0 }] };
    default:
      return room;
  }
}
