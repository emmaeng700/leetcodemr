/**
 * Shared syntax-highlight token colors (One Dark–style, matches flashcard CodePanel).
 * Root `.hljs` background is set per surface (full block vs per-line).
 */
export const CODE_HIGHLIGHT_TOKEN_CSS = `
.hljs-keyword { color: #c678dd; }
.hljs-built_in { color: #e6c07b; }
.hljs-string { color: #98c379; }
.hljs-number { color: #d19a66; }
.hljs-comment { color: #abb2bf; font-style: italic; }
.hljs-function .hljs-title, .hljs-title.function_ { color: #61afef; }
.hljs-class .hljs-title, .hljs-title.class_ { color: #e5c07b; }
.hljs-params { color: #abb2bf; }
.hljs-operator { color: #56b6c2; }
.hljs-punctuation { color: #abb2bf; }
.hljs-attr { color: #e06c75; }
.hljs-variable { color: #e06c75; }
.hljs-literal { color: #56b6c2; }
.hljs-type { color: #e5c07b; }
.hljs-meta { color: #8b95a5; }
.hljs-subst { color: #abb2bf; }
`
