/**
 * Curated allowlisted GIFs (Giphy CDN) used as a local pack / fallback.
 * Keep URLs on media*.giphy.com / i.giphy.com so moderation allowlist accepts them.
 * Live search also pulls from otakugifs (open API) when no GIPHY_API_KEY is set.
 */
export const CURATED_PREDICTION_GIFS: Array<{
  id: string;
  title: string;
  tags: string[];
  url: string;
  preview: string;
}> = [
  {
    id: 'l0MYt5jPR6QX5pnqM',
    title: 'Yes',
    tags: ['yes', 'да', 'ok', 'agree', 'funny'],
    url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    preview: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy-preview.gif',
  },
  {
    id: '3o7abKhOpu0NwenH3O',
    title: 'No',
    tags: ['no', 'нет', 'nope', 'funny'],
    url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
    preview: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy-preview.gif',
  },
  {
    id: 'JIX9t2j0ZTN9S',
    title: 'Cat',
    tags: ['cat', 'кот', 'funny', 'lol', 'cute'],
    url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
    preview: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy-preview.gif',
  },
  {
    id: '3oEjI6SIIHBdRxXI40',
    title: 'Clap',
    tags: ['clap', 'аплодисменты', 'bravo', 'win', 'funny'],
    url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
    preview: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy-preview.gif',
  },
  {
    id: '26ufdipQqU2lhNA4g',
    title: 'Mind blown',
    tags: ['wow', 'mind', 'blown', 'omg', 'funny'],
    url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
    preview: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy-preview.gif',
  },
  {
    id: 'l3q2K5jinAlChoCLS',
    title: 'This is fine',
    tags: ['fine', 'fire', 'ok', 'funny', 'lol'],
    url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif',
    preview: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy-preview.gif',
  },
  {
    id: '26BRuo6sLetdllPAQ',
    title: 'Thumbs up',
    tags: ['thumbs', 'up', 'like', 'yes', 'ok', 'funny'],
    url: 'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif',
    preview: 'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy-preview.gif',
  },
  {
    id: 'l0HlvtIPzPdt2usKs',
    title: 'Thinking',
    tags: ['think', 'hmm', 'думаю', 'maybe', 'funny'],
    url: 'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif',
    preview: 'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy-preview.gif',
  },
  {
    id: '3oriO0OEd9QIDdllqo',
    title: 'Money',
    tags: ['money', 'деньги', 'rich', 'cash', 'funny'],
    url: 'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif',
    preview: 'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy-preview.gif',
  },
  {
    id: '13HgwGsXF0aiGY',
    title: 'Confused Travolta',
    tags: ['confused', 'what', 'huh', 'funny', 'lol'],
    url: 'https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif',
    preview: 'https://media.giphy.com/media/13HgwGsXF0aiGY/giphy-preview.gif',
  },
  {
    id: 'xT5LMHxhOfscxPfIfm',
    title: 'Excited',
    tags: ['excited', 'happy', 'win', 'yes', 'funny'],
    url: 'https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy.gif',
    preview: 'https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy-preview.gif',
  },
  {
    id: 'd3mlE7uhX8KFgEmY',
    title: 'Deal with it',
    tags: ['cool', 'deal', 'sunglasses', 'funny'],
    url: 'https://media.giphy.com/media/d3mlE7uhX8KFgEmY/giphy.gif',
    preview: 'https://media.giphy.com/media/d3mlE7uhX8KFgEmY/giphy-preview.gif',
  },
  {
    id: '3o7TKSjRrfIPjeiVyM',
    title: 'Facepalm',
    tags: ['facepalm', 'fail', 'no', 'funny', 'lol'],
    url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
    preview: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy-preview.gif',
  },
  {
    id: 'l0MYJnJQ4EiYLxvQ4',
    title: 'Slow clap',
    tags: ['clap', 'bravo', 'sarcasm', 'funny'],
    url: 'https://media.giphy.com/media/l0MYJnJQ4EiYLxvQ4/giphy.gif',
    preview: 'https://media.giphy.com/media/l0MYJnJQ4EiYLxvQ4/giphy-preview.gif',
  },
  {
    id: '26tPplGWjN0xLybiU',
    title: 'Mic drop',
    tags: ['win', 'drop', 'done', 'funny', 'yes'],
    url: 'https://media.giphy.com/media/26tPplGWjN0xLybiU/giphy.gif',
    preview: 'https://media.giphy.com/media/26tPplGWjN0xLybiU/giphy-preview.gif',
  },
  {
    id: '3o7aCTPPm4OHfRLSH6',
    title: 'Shocked',
    tags: ['shocked', 'omg', 'wow', 'surprised', 'funny'],
    url: 'https://media.giphy.com/media/3o7aCTPPm4OHfRLSH6/giphy.gif',
    preview: 'https://media.giphy.com/media/3o7aCTPPm4OHfRLSH6/giphy-preview.gif',
  },
  {
    id: 'l3vR85PnGsBwu1PFK',
    title: 'Crying',
    tags: ['cry', 'sad', 'lose', 'нет', 'funny'],
    url: 'https://media.giphy.com/media/l3vR85PnGsBwu1PFK/giphy.gif',
    preview: 'https://media.giphy.com/media/l3vR85PnGsBwu1PFK/giphy-preview.gif',
  },
];
