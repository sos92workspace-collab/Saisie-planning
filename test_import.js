const fs = require('fs');

const text = `Med	Date	Heure_Deb	Heure_Deb_822	Heure_Fin	Heure_Fin_822	CaseAbrege	ColNum	TypeGarde
AZZ	03/05/2026	13:00:00	Fri, 01 May 2026 06:00:00 +0100	19:00:00	Fri, 01 May 2026 00:00:00 +0100	 C1 AP BOU	29	C
AZZ	04/05/2026	13:00:00	Fri, 01 May 2026 06:00:00 +0100	19:00:00	Fri, 01 May 2026 00:00:00 +0100	 C2 AP BOU	30	C
YYY	01/05/2026	07:00:00	Sun, 17 May 2026 08:00:00 +0100	13:00:00	Sun, 17 May 2026 00:00:00 +0100	Vis. Matin	10	V`;

const lines = text.split('\n').filter(l => l.trim());

let rows = lines;
const firstLine = lines[0]?.toLowerCase() || '';
if (firstLine.includes('trigram') || firstLine.includes('id') || firstLine.includes('date') || firstLine.includes('med')) {
    rows = lines.slice(1);
}

let targetMonthYear = '2026-4';
let targetYear = -1;
let targetMonth = -1;
if (targetMonthYear !== 'ALL') {
    const parts = targetMonthYear.split('-');
    targetYear = Number(parts[0]);
    targetMonth = Number(parts[1]);
}

const upserts = rows.map(line => {
    let cols = line.split('\t').map(c => c.trim());
    if (cols.length < 8) {
        cols = line.split(';').map(c => c.trim());
    }
    if (cols.length < 8) {
        cols = line.split(',').map(c => c.trim());
    }
    
    if (cols.length < 8) {
        console.log("Failed length:", cols.length, line);
        return null;
    }

    const trigram = cols[0];
    if (trigram === 'ZZZ' || trigram === 'YYY' || trigram === 'XXX') {
        console.log("Failed trigram:", trigram);
        return null;
    }

    const dateParts = cols[1].split('/');
    if (dateParts.length !== 3) {
        console.log("Failed dateParts:", dateParts);
        return null;
    }
    const day = Number(dateParts[0]);
    const month = Number(dateParts[1]) - 1; // JS months are 0-indexed
    const year = Number(dateParts[2]);
    
    if (targetMonthYear !== 'ALL' && (year !== targetYear || month !== targetMonth)) {
        console.log("Failed targetMonthYear:", year, month, targetYear, targetMonth);
        return null;
    }

    const colId = Number(cols[7]);
    if (isNaN(colId)) {
        console.log("Failed colId:", cols[7]);
        return null;
    }

    return {
        id: "123",
        user_trigram: trigram,
        year: year,
        month: month + 1,
        row: day,
        col: colId,
    };
}).filter(x => x && x.id && x.user_trigram);

console.log(upserts);
