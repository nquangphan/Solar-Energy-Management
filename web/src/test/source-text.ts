// Comment/string-aware views of a source file for the text guards (network guard,
// composition-root guard). A `//` inside a string hides nothing, and a forbidden
// word inside a comment or a UI string is not code.
const TOKEN = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\[\s\S]|[^`\\])*`/g;

/** Comments dropped, strings kept. */
export function withoutComments(code: string): string {
  return code.replace(TOKEN, (t) => (t.startsWith('/') ? '' : t));
}

/** Comments dropped and quoted strings emptied (template literals kept: an interpolation is code). */
export function codeOnly(code: string): string {
  return code.replace(TOKEN, (t) => (t.startsWith('/') ? '' : t.startsWith('`') ? t : `${t[0]}${t[0]}`));
}
