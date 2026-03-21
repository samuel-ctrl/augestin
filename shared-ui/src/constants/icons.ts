export const iconMap: Record<string, string> = {
  book: "📖",
  atom: "⚛️",
  calculator: "🧮",
  flask: "🧪",
  microscope: "🔬",
  globe: "🌍",
  palette: "🎨",
  music: "🎵",
  dumbbell: "💪",
  laptop: "💻",
  language: "🗣️",
  history: "🏛️",
  economics: "📊",
  civics: "⚖️",
  leaf: "🌿",
  dna: "🧬",
  lightning: "⚡",
  compass: "🧭",
  ruler: "📏",
  pen: "✒️",
};

export const iconKeys = Object.keys(iconMap);

export const standardOptions = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}${getSuffix(i + 1)}`,
}));

function getSuffix(n: number): string {
  if (n === 1) return "st";
  if (n === 2) return "nd";
  if (n === 3) return "rd";
  return "th";
}
