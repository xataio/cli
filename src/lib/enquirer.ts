import * as chrono from 'chrono-node';
import enquirer from 'enquirer';

export async function inputPrompt<T = string>(
  isInteractive: boolean,
  message: string,
  { flag, placeholder }: { flag?: T; placeholder?: T } = {}
) {
  if (flag) {
    return flag;
  }

  if (!isInteractive) {
    return '';
  }

  const inputPrompt = await enquirer.prompt<{ input: T }>({
    type: 'input',
    name: 'input',
    message,
    initial: placeholder
  });
  return inputPrompt.input;
}

export async function confirmPrompt(isInteractive: boolean, message: string) {
  if (!isInteractive) {
    return '';
  }

  const confirmPrompt = await enquirer.prompt<{ confirm: boolean }>({
    type: 'confirm',
    name: 'confirm',
    message
  });
  return confirmPrompt.confirm;
}

type Choice = {
  name: string; // this is the value
  message: string; // this is the label
};

export async function selectPrompt<T extends Choice>(
  isInteractive: boolean,
  message: string,
  choices: T[],
  { flag, initial }: { flag?: T['name']; initial?: number } = {}
) {
  if (flag) {
    return flag;
  }

  if (!isInteractive) {
    return '';
  }

  const selectPrompt = await enquirer.prompt<{ value: string }>({
    type: 'select',
    name: 'value',
    message,
    choices,
    initial
  });

  return selectPrompt.value;
}

export async function multiselectPrompt(isInteractive: boolean, message: string, choices: Choice[], initial: string[]) {
  if (!isInteractive) {
    return [];
  }

  const multiselectPrompt = await enquirer.prompt<{ value: string[] }>({
    name: 'value',
    type: 'multiselect',
    message,
    //@ts-expect-error fix types
    choices,
    initial,
    validate: (value) => value.length > 0 || 'You must select at least one option'
  });
  return multiselectPrompt.value;
}

export async function datePrompt(isInteractive: boolean, message: string, defaultValue?: string) {
  if (!isInteractive) {
    return null;
  }

  const datePrompt = await enquirer.prompt<{ date: string }>({
    type: 'input',
    name: 'date',
    message,
    initial: defaultValue,
    validate(value) {
      const date = chrono.parseDate(value);
      return date ? true : 'Invalid date format';
    }
  });

  return chrono.parseDate(datePrompt.date);
}
