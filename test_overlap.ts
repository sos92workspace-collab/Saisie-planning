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

console.log("18h-08h vs 08h-18h", doRangesOverlap("18h-08h", "08h-18h", 0));
console.log("18h-08h vs 20h-02h", doRangesOverlap("18h-08h", "20h-02h", 0));
console.log("08h-18h vs 12h-16h", doRangesOverlap("08h-18h", "12h-16h", 0));
console.log("08h-18h vs 17h-20h", doRangesOverlap("08h-18h", "17h-20h", 0));
console.log("08h-18h vs 17h-20h (60m)", doRangesOverlap("08h-18h", "17h-20h", 60));
console.log("08h-18h vs 17h-20h (59m)", doRangesOverlap("08h-18h", "17h-20h", 59));
