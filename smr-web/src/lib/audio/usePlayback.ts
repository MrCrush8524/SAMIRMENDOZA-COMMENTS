import { useEffect, useRef, useState } from "react";
import { PlaybackController, type PlaybackState } from "./playbackController";

let singleton: PlaybackController | null = null;
function getController(): PlaybackController {
  if (!singleton) singleton = new PlaybackController();
  return singleton;
}

export function usePlayback() {
  const controllerRef = useRef(getController());
  const [state, setState] = useState<PlaybackState>({
    isPlaying: false,
    chunkIndex: 0,
    chunkCount: 0,
    currentTime: 0,
    duration: 0,
    speed: 1
  });

  useEffect(() => controllerRef.current.subscribe(setState), []);

  return { controller: controllerRef.current, state };
}
