import chalk from 'chalk';
import { stdin, stdout } from 'node:process';
import stripAnsi from 'strip-ansi';
import Table from 'cli-table3';
import { borderlessTableOptions } from '~/lib/table';

interface TerminalUIProps {
  schema: any[];
  formattedSchema: string;
  onExecuteSQL: (sql: string) => Promise<any[]>;
  onGenerateSQL: (query: string, currentSQL: string) => Promise<string>;
}

export class TerminalUI {
  private input = '';
  private currentSQL = '';
  private awaitingConfirmation = false;
  private currentResults = '';
  private schema: any[];

  private onExecuteSQL: (sql: string) => Promise<any[]>;
  private onGenerateSQL: (query: string, currentSQL: string) => Promise<string>;

  constructor({ schema, onExecuteSQL, onGenerateSQL }: TerminalUIProps) {
    this.schema = schema;
    this.onExecuteSQL = onExecuteSQL;
    this.onGenerateSQL = onGenerateSQL;
  }

  private clearScreen() {
    stdout.write('\x1b[2J\x1b[H');
  }

  private drawBorder(width: number, char = '─') {
    return `┌${char.repeat(width - 2)}┐`;
  }

  private drawBottomBorder(width: number, char = '─') {
    return `└${char.repeat(width - 2)}┘`;
  }

  private getVisualLength(str: string): number {
    // Remove ANSI escape sequences to get the actual visual length
    return stripAnsi(str).length;
  }

  private drawSideBorder(content: string, width: number) {
    const visualLength = this.getVisualLength(content);
    const padding = Math.max(0, width - visualLength - 2);
    return `│${content}${' '.repeat(padding)}│`;
  }

  private render(resultsContent: string) {
    this.clearScreen();

    const width = process.stdout.columns || 80; // Use full screen width

    // Input box
    const inputLabel = this.awaitingConfirmation
      ? '❓ Execute this query? (y/n)'
      : '🧠 Enter your query description (Enter to submit, Ctrl+C to quit)';

    console.log(chalk.cyan(this.drawBorder(width)));
    console.log(chalk.cyan(this.drawSideBorder(inputLabel, width)));
    console.log(chalk.cyan(this.drawSideBorder('', width)));
    console.log(chalk.cyan(this.drawSideBorder(this.input, width)));
    console.log(chalk.cyan(this.drawBottomBorder(width)));

    console.log('');

    // Results box
    console.log(chalk.green(this.drawBorder(width)));
    console.log(chalk.green(this.drawSideBorder('📊 Results', width)));
    console.log(chalk.green(this.drawSideBorder('', width)));

    const lines = resultsContent.split('\n');
    for (const line of lines) {
      // Show all lines
      const visualLength = this.getVisualLength(line);
      let cleanLine = line;

      if (visualLength > width - 4) {
        // Truncate but preserve color codes
        const strippedLine = stripAnsi(line);
        const truncatedStripped = `${strippedLine.substring(0, width - 7)}...`;
        cleanLine = truncatedStripped; // For now, just use the truncated version
      }

      console.log(chalk.green(this.drawSideBorder(cleanLine, width)));
    }

    console.log(chalk.green(this.drawBottomBorder(width)));
  }

  private async handleSubmit() {
    const userInput = this.input.trim();
    if (!userInput) return;

    if (this.awaitingConfirmation) {
      const response = userInput.toLowerCase();
      this.input = '';

      if (response === 'y' || response === 'yes') {
        try {
          this.render(chalk.blue('⚡ Executing query...\n\n') + chalk.white(this.currentSQL));

          const queryResults = await this.onExecuteSQL(this.currentSQL);
          const formattedResults = this.formatResultsForDisplay(queryResults);

          this.currentResults = formattedResults + chalk.cyan('\n\nEnter a new query above...');
          this.awaitingConfirmation = false;
          this.render(this.currentResults);
        } catch (error) {
          this.currentResults =
            chalk.red(`❌ SQL Execution Error: ${error}\n\n`) +
            chalk.white(this.currentSQL) +
            chalk.cyan('\n\nEnter a new query above...');
          this.awaitingConfirmation = false;
          this.render(this.currentResults);
        }
      } else {
        this.currentResults =
          chalk.yellow('Query execution cancelled.\n\n') +
          chalk.white(this.currentSQL) +
          chalk.cyan('\n\nEnter a new query above...');
        this.awaitingConfirmation = false;
        this.render(this.currentResults);
      }
      return;
    }

    try {
      this.currentResults = chalk.blue('🤖 AI is generating SQL...');
      this.render(this.currentResults);

      const generatedSQL = await this.onGenerateSQL(userInput, this.currentSQL);
      this.currentSQL = generatedSQL;

      this.input = '';
      this.awaitingConfirmation = true;
      this.render(this.getCurrentResults());
    } catch (error) {
      this.currentResults = chalk.red(`❌ AI Generation Error: ${error}\n\nTry again with a different description...`);
      this.render(this.currentResults);
    }
  }

  private formatResultsForDisplay(results: any[]): string {
    if (results.length === 0) {
      return chalk.yellow('No results returned.');
    }

    if (results.length > 0) {
      const firstResult = results[0];
      const headers = Object.keys(firstResult);

      const table = new Table({
        ...borderlessTableOptions,
        head: headers.map((h) => chalk.cyan(h)),
        style: {
          ...borderlessTableOptions.style,
          head: ['cyan'],
          border: ['grey']
        }
      });

      const displayRows = results.slice(0, 20);
      displayRows.forEach((row) => {
        table.push(
          headers.map((header) => {
            const value = row[header];
            return value !== null && value !== undefined ? String(value) : chalk.gray('NULL');
          })
        );
      });

      let output = `${chalk.green(`📊 Results (${results.length} rows):`)}\n\n${table.toString()}`;

      if (results.length > 20) {
        output += `\n${chalk.yellow(`... and ${results.length - 20} more rows`)}`;
      }

      return output;
    }

    return '';
  }

  private setupInput() {
    stdin.setRawMode!(true);
    stdin.setEncoding('utf8');

    stdin.on('data', (key: string) => {
      // Handle Ctrl+C
      if (key === '\u0003') {
        this.cleanup();
        process.exit(0);
      }

      // Handle Enter
      if (key === '\r' || key === '\n') {
        this.handleSubmit().catch(console.error);
        return;
      }

      // Handle Backspace
      if (key === '\u007F' || key === '\b') {
        this.input = this.input.slice(0, -1);
        this.render(this.getCurrentResults());
        return;
      }

      // Handle Escape
      if (key === '\u001B') {
        this.cleanup();
        process.exit(0);
      }

      // Handle regular characters
      if (key.length === 1 && key >= ' ') {
        this.input += key;
        this.render(this.getCurrentResults());
      }
    });
  }

  private getCurrentResults(): string {
    if (this.awaitingConfirmation) {
      return chalk.green('📝 Generated SQL:\n\n') + chalk.white(this.currentSQL);
    }

    if (this.currentResults) {
      return this.currentResults;
    }

    return (
      chalk.green(`✅ Connected! Schema loaded successfully.\n`) +
      chalk.gray(
        `Found ${this.schema.length} schema(s) with ${this.schema.reduce((total, s) => total + Object.keys(s.tables).length, 0)} table(s)\n\n`
      ) +
      chalk.yellow('Enter a natural language description above to generate SQL...')
    );
  }

  private cleanup() {
    stdin.setRawMode!(false);
    this.clearScreen();
  }

  public start() {
    this.setupInput();
    const initialResults = this.getCurrentResults();
    this.render(initialResults);

    process.on('SIGINT', () => {
      this.cleanup();
      process.exit(0);
    });

    process.on('exit', () => {
      this.cleanup();
    });

    return new Promise<void>(() => {
      // Keep the process running
    });
  }
}
