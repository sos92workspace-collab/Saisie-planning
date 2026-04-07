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

console.log("08h-12h vs 13h-19h:", doRangesOverlap("08h-12h", "13h-19h"));
console.log("06h-13h vs 12h-16h:", doRangesOverlap("06h-13h", "12h-16h"));
console.log("06h-13h vs 12h-16h (60m):", doRangesOverlap("06h-13h", "12h-16h", 60));
console.log("08h-18h vs 18h-08h:", doRangesOverlap("08h-18h", "18h-08h"));
console.log("18h-08h vs 08h-18h:", doRangesOverlap("18h-08h", "08h-18h"));
console.log("08h-08h vs 08h-12h:", doRangesOverlap("08h-08h", "08h-12h"));
console.log("08h-08h vs 01h-06h:", doRangesOverlap("08h-08h", "01h-06h"));
