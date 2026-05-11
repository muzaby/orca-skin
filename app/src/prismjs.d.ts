declare module 'prismjs' {
  export interface Language {
    [key: string]: any;
  }

  export interface Prism {
    languages: { [key: string]: Language };
    highlight(code: string, grammar: Language, language: string): string;
  }

  const Prism: Prism;
  export default Prism;
}
