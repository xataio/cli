import { useStdout } from 'ink';
import { useTerminalSize } from '~/console/hooks/use-terminal-size';
import { SQLView, type SQLViewProps } from './sql-view';

export const AIApp = (props: Omit<SQLViewProps, 'columns' | 'rows' | 'isActive'>) => {
  const { stdout } = useStdout();
  const size = useTerminalSize(stdout);
  return <SQLView {...props} {...size} isActive />;
};
