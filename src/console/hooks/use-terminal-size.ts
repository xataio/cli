import { useEffect, useState } from 'react';

export type TerminalSize = {
  columns: number;
  rows: number;
};

export function useTerminalSize(stdout: NodeJS.WriteStream): TerminalSize {
  const [size, setSize] = useState<TerminalSize>(() => readTerminalSize(stdout));

  useEffect(() => {
    const update = () => setSize(readTerminalSize(stdout));
    stdout.on('resize', update);
    return () => {
      stdout.off('resize', update);
    };
  }, [stdout]);

  return size;
}

function readTerminalSize(stdout: NodeJS.WriteStream): TerminalSize {
  return { columns: stdout.columns || 80, rows: stdout.rows || 24 };
}
