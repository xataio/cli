// Bun's text loader (`import x from './file' with { type: 'text' }`) returns the
// file contents as a string and embeds the file into `bun build --compile`
// binaries. These declarations keep `tsc` happy for the files we embed.
declare module '*/NOTICE' {
  const content: string;
  export default content;
}

declare module '*.txt' {
  const content: string;
  export default content;
}
