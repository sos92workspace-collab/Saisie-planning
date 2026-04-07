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
  return { start, end, match: match.slice(1) };
};

console.log("12:00-16:00", parseTimeRange("12:00-16:00"));
console.log("12.30-16.30", parseTimeRange("12.30-16.30"));
console.log("12h-16h", parseTimeRange("12h-16h"));
console.log("12-16", parseTimeRange("12-16"));
console.log("12h30 - 16h30", parseTimeRange("12h30 - 16h30"));
