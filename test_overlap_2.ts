const doRangesOverlap = (r1: {start: number, end: number}, r2: {start: number, end: number}, maxOverlapMinutes: number = 0): boolean => {
  const overlapStart = Math.max(r1.start, r2.start);
  const overlapEnd = Math.min(r1.end, r2.end);
  
  if (overlapStart < overlapEnd) {
      return (overlapEnd - overlapStart) > maxOverlapMinutes;
  }
  return false;
};

console.log("8-13 and 13-20 (max 0):", doRangesOverlap({start: 8*60, end: 13*60}, {start: 13*60, end: 20*60}, 0));
console.log("8-13 and 12-20 (max 0):", doRangesOverlap({start: 8*60, end: 13*60}, {start: 12*60, end: 20*60}, 0));
console.log("8-13 and 12-20 (max 60):", doRangesOverlap({start: 8*60, end: 13*60}, {start: 12*60, end: 20*60}, 60));
console.log("8-13 and 12-20 (max 59):", doRangesOverlap({start: 8*60, end: 13*60}, {start: 12*60, end: 20*60}, 59));
