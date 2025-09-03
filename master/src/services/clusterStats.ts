import { nowMs } from "../utils/time";
import { UsagePoint } from "../models/types";

// Simple in-memory ring buffer for recent cluster usage samples.
export function createClusterStats(maxSamples = 3600) {
  const buf: UsagePoint[] = [];

  const addSample = (sample: UsagePoint) => {
    buf.push(sample);
    if (buf.length > maxSamples) buf.shift();
  };

  // return samples covering the last `windowMs` milliseconds
  const getRecent = (windowMs: number) => {
    const cutoff = nowMs() - windowMs;
    return buf.filter((s) => s.t >= cutoff);
  };

  const getAll = () => buf.slice();

  return { addSample, getRecent, getAll };
}

export const clusterStats = createClusterStats();
