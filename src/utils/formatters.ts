/**
 * Formats a duration in seconds into HH:MM:SS
 */
export function formatTimeHHMMSS(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hrs, mins, secs]
    .map((v) => String(v).padStart(2, '0'))
    .join(':');
}

/**
 * Formats seconds into a human friendly string, e.g. "2h 45m" or "32m"
 */
export function formatDurationHuman(seconds: number): string {
  if (seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0 || hrs === 0) parts.push(`${mins}m`);
  return parts.join(' ');
}
