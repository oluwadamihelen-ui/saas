export interface MusicPromptEpisode {
  title: string;
  synopsis: string | null;
}

export interface MusicPromptStoryBible {
  genres: string[];
  tones: string[];
}

/** Builds an instrumental-score prompt from an episode's story bible genre/tone and synopsis. */
export function buildMusicPrompt(episode: MusicPromptEpisode, storyBible: MusicPromptStoryBible | null): string {
  const genreText = storyBible?.genres.length ? storyBible.genres.join(", ") : "cinematic drama";
  const toneText = storyBible?.tones.length ? storyBible.tones.join(", ") : "atmospheric";
  const synopsisText = episode.synopsis ? ` The episode is about: ${episode.synopsis}.` : "";
  return `Instrumental background score for a ${genreText} episode titled "${episode.title}". Tone: ${toneText}.${synopsisText} No vocals, no lyrics — score only.`;
}
