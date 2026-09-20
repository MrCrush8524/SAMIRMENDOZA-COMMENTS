import { useEffect, useState } from "react";
import { getModelLoadState, subscribeModelLoadState } from "./kokoroEngine";
import type { ModelLoadState } from "../types";

export function useModelLoadState(): ModelLoadState {
  const [state, setState] = useState<ModelLoadState>(getModelLoadState());
  useEffect(() => subscribeModelLoadState(setState), []);
  return state;
}
