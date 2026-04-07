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

const ranges = [
  "06h-13h", "07h-13h", "08h-12h", "12h-16h", "13h-19h", 
  "12h-20h", "16h-20h", "17h-23h", "19h-01h", "20h-01h", 
  "20h-08h", "21h-03h", "01h-06h"
];

for (let i = 0; i < ranges.length; i++) {
  for (let j = i + 1; j < ranges.length; j++) {
    if (doRangesOverlap(ranges[i], ranges[j])) {
      console.log(`${ranges[i]} overlaps with ${ranges[j]}`);
    }
  }
}
