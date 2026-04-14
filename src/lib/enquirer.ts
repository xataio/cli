import * as chrono from 'chrono-node';
import enquirer from 'enquirer';

export async function inputPrompt<T = string>(
  isCI: boolean,
  message: string,
  { flag, placeholder }: { flag?: T; placeholder?: T } = {}
) {
  if (flag) {
    return flag;
  }

  if (isCI) {
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

export async function confirmPrompt(isCI: boolean, message: string) {
  if (isCI) {
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
  isCI: boolean,
  message: string,
  choices: T[],
  { flag }: { flag?: T['name'] } = {}
) {
  if (flag) {
    return flag;
  }

  if (isCI) {
    return '';
  }

  const selectPrompt = await enquirer.prompt<{ value: string }>({
    type: 'select',
    name: 'value',
    message,
    choices
  });

  return selectPrompt.value;
}

export async function multiselectPrompt(isCI: boolean, message: string, choices: Choice[], initial: string[]) {
  if (isCI) {
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

export async function datePrompt(isCI: boolean, message: string, defaultValue?: string) {
  if (isCI) {
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
