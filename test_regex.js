const equations = [
  "1 GC (44/45) + 2 B + 1 N",
  "1 GC (44/45) + 1 B + 2 N",
  "1 GC (44/45) + 3 N",
  "1 GC (46) + 1 B",
  "1 GC (46) + 1 N",
  "1 GC + 1 B + 1 N",
  "1 GC + 2 N",
  "2 GC + 1 B",
  "2 GC + 2 B (Avec Visite)",
  "0 GC + 1 B (Sans Visite)",
  "1 GC + 2 B",
  "1 B"
];
equations.forEach(equation => {
  const gcMatch = equation.match(/(\d+)\s*GC/); 
  const bMatch = equation.match(/(\d+)\s*B/); 
  const nMatch = equation.match(/(\d+)\s*N/); 
  console.log(`Equation: '${equation}' => GC: ${gcMatch ? gcMatch[1] : 0}, B: ${bMatch ? bMatch[1] : 0}, N: ${nMatch ? nMatch[1] : 0}`);
});
