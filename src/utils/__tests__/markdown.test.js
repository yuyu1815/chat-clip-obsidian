import { htmlToMarkdown, toMarkdownIfHtml } from '../markdown';

describe('markdown utils', () => {
  test('htmlToMarkdown converts simple HTML to markdown', () => {
    const html = '<h1>Title</h1><p>Hello <strong>world</strong>!</p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('# Title');
    expect(md).toContain('Hello **world**!');
  });

  test('toMarkdownIfHtml passes through plain text', () => {
    const text = 'just text';
    expect(toMarkdownIfHtml(text)).toBe(text);
  });
});
