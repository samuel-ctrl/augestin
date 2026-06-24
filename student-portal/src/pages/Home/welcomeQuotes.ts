// Motivational / encouragement subtitles shown on the student home banner.
// One is picked at random on each visit to the home page (stored frontend-side).
export const WELCOME_QUOTES: string[] = [
  "Every expert was once a beginner. Keep going!",
  "Small steps every day lead to big results.",
  "Mistakes are proof that you're trying — learn and grow.",
  "Your only competition is who you were yesterday.",
  "Focus on progress, not perfection.",
  "A little progress each day adds up to big results.",
  "Believe in yourself — you're capable of amazing things.",
  "Hard work beats talent when talent doesn't work hard.",
  "Stay curious. Every question is a step forward.",
  "Don't watch the clock; do what it does — keep going.",
  "Success is the sum of small efforts repeated daily.",
  "The secret to getting ahead is getting started.",
  "Push yourself, because no one else will do it for you.",
  "Learning never exhausts the mind — dive in!",
  "Dream big, study hard, stay focused.",
  "One chapter at a time — you've got this!",
  "Challenges are what make learning interesting.",
  "Be patient with yourself. Growth takes time.",
  "Today's effort is tomorrow's achievement.",
  "Knowledge is a treasure that follows you everywhere.",
  "Consistency is more important than intensity.",
  "Great things take time — keep practicing.",
  "You don't have to be perfect, just persistent.",
  "Make today count — your future self will thank you.",
];

/** Returns a random welcome subtitle. Call once per home-page mount. */
export function getRandomWelcomeQuote(): string {
  const index = Math.floor(Math.random() * WELCOME_QUOTES.length);
  return WELCOME_QUOTES[index];
}
