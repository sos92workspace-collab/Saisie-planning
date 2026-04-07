import * as fs from 'fs';

const content = fs.readFileSync('constants.ts', 'utf8');

const parseTimeRange = (range: string) => {
  if (!range) return null;
  const match = range.match(/(\d+)(?:[hH:\.](\d*))?\s*[-a-zA-Zà-ÿ\s/,]*\s*(\d+)(?:[hH:\.](\d*))?/);
  if (!match) return null;
  let startHour = parseInt(match[1], 10);
  let startMin = match[2] ? parseInt(match[2], 10) || 0 : 0;
  let endHour = parseInt(match[3], 10);
  let endMin = match[4] ? parseInt(match[4], 10) || 0 : 0;
  
  let start = startHour * 60 + startMin;
  let end = endHour * 60 + endMin;
  
  if (end <= start) end += 24 * 60;
  return { start, end };
};

const doRangesOverlap = (r1: string, r2: string, maxOverlapMinutes = 0) => {
  const t1 = parseTimeRange(r1);
  const t2 = parseTimeRange(r2);
  if (!t1 || !t2) return false;
  
  const overlapStart = Math.max(t1.start, t2.start);
  const overlapEnd = Math.min(t1.end, t2.end);
  
  if (overlapStart < overlapEnd) {
      return (overlapEnd - overlapStart) > maxOverlapMinutes;
  }
  return false;
};

const timeRanges = new Set<string>();
const regex = /timeRange:\s*'([^']+)'/g;
let match;
while ((match = regex.exec(content)) !== null) {
  timeRanges.add(match[1]);
}

const ranges = Array.from(timeRanges);
console.log("Found ranges:", ranges);

for (let i = 0; i < ranges.length; i++) {
  for (let j = 0; j < ranges.length; j++) {
    if (i !== j && doRangesOverlap(ranges[i], ranges[j])) {
      console.log(`${ranges[i]} overlaps with ${ranges[j]}`);
    }
  }
}
