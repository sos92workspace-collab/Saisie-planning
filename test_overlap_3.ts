const parseTimeRange = (range: string): { start: number, end: number } | null => {
  if (!range) return null;
  
  const lowerRange = range.toLowerCase().trim();
  if (lowerRange === 'journée' || lowerRange === 'journee' || lowerRange === '24h' || lowerRange === 'full') {
      return { start: 0, end: 24 * 60 };
  }
  if (lowerRange === 'nuit') {
      return { start: 20 * 60, end: 20 * 60 + 12 * 60 }; // 20h to 08h next day
  }
  if (lowerRange === 'matin') {
      return { start: 8 * 60, end: 13 * 60 };
  }
  if (lowerRange === 'aprem' || lowerRange === 'après-midi' || lowerRange === 'apres-midi') {
      return { start: 13 * 60, end: 19 * 60 };
  }
  if (lowerRange === 'soir') {
      return { start: 19 * 60, end: 24 * 60 };
  }

  const timePattern = /(\d{1,2})(?:[hH:\.](\d{1,2}))?(?:[:\.]\d{1,2})?/g;
  const matches = [...range.matchAll(timePattern)];
  
  if (matches.length >= 2) {
    let startHour = parseInt(matches[0][1], 10);
    let startMin = matches[0][2] ? parseInt(matches[0][2], 10) : 0;
    
    let endHour = parseInt(matches[1][1], 10);
    let endMin = matches[1][2] ? parseInt(matches[1][2], 10) : 0;
    
    let start = startHour * 60 + startMin;
    let end = endHour * 60 + endMin;
    
    if (end <= start) end += 24 * 60;
    return { start, end };
  }
  
  return null;
};

const doRangesOverlap = (r1: string, r2: string, maxOverlapMinutes: number = 0): boolean => {
  const t1 = parseTimeRange(r1);
  const t2 = parseTimeRange(r2);
  if (!t1 || !t2) return false;
  
  // Calculate overlap in minutes
  const overlapStart = Math.max(t1.start, t2.start);
  const overlapEnd = Math.min(t1.end, t2.end);
  
  if (overlapStart < overlapEnd) {
      return (overlapEnd - overlapStart) > maxOverlapMinutes;
  }
  return false;
};

console.log("8h-13h and 13h-20h (max 0):", doRangesOverlap("8h-13h", "13h-20h", 0));
console.log("08:00:00 - 13:00:00 and 13:00:00 - 20:00:00 (max 0):", doRangesOverlap("08:00:00 - 13:00:00", "13:00:00 - 20:00:00", 0));
console.log("08:00:00 - 13:40:00 and 13:00:00 - 20:00:00 (max 0):", doRangesOverlap("08:00:00 - 13:40:00", "13:00:00 - 20:00:00", 0));
console.log("08:00:00 - 13:40:00 and 13:00:00 - 20:00:00 (max 40):", doRangesOverlap("08:00:00 - 13:40:00", "13:00:00 - 20:00:00", 40));
console.log("08:00:00 - 13:40:00 and 13:00:00 - 20:00:00 (max 39):", doRangesOverlap("08:00:00 - 13:40:00", "13:00:00 - 20:00:00", 39));
