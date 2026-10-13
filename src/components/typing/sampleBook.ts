import type { Book } from '../../typingStore'

export const SAMPLE_BOOK: Book = {
  id: 'sample-welcome-book',
  title: 'Welcome to Typing',
  author: ['Flashcard'],
  importedAt: 0,
  chapters: [
    {
      id: 'welcome-intro',
      title: 'Introduction',
      content: [
        'Hi! Start typing this chapter. Press Enter to finish the paragraph.',
        'Typing Mode, which you are currently in, allows you to enjoy books while practicing touch typing.',
        'After each completed paragraph, your progress is saved, and the timer is paused allowing you to rest.',
        'If too many mistakes interrupt your flow, you can restart the current paragraph by pressing Tab. Try it in the next section.',
      ].join('\n'),
      children: [
        {
          id: 'welcome-reset',
          title: 'Resetting a paragraph',
          content: 'Make some mistakes and reset this paragraph.',
          children: [],
        },
        {
          id: 'welcome-foreign',
          title: 'Foreign characters',
          content: [
            'If you encounter foreign characters that are not easily typed on your keyboard, you can press any character (including Space bar) to mark them as typed. Try it now with the Japanese hello: こんにちは',
            'Remember to always fix your mistakes, as they have a big impact on your final score and overall progress as a typist.',
          ].join('\n'),
          children: [],
        },
      ],
    },
  ],
}
