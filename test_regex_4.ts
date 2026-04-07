const parseTimeRange = (range: string) => {
  // Extract all time patterns like 08:00:00, 08:00, 08h00, 8h, 8
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

console.log("08:00:00 - 13:40:00", parseTimeRange("08:00:00 - 13:40:00"));
console.log("06h-13h", parseTimeRange("06h-13h"));
console.log("8h30 - 13h30", parseTimeRange("8h30 - 13h30"));
console.log("08:00 - 13:40", parseTimeRange("08:00 - 13:40"));
