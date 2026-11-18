import Resolver from '@forge/resolver';
import { getDesk, saveBet, saveSettings } from './desk.js';

const resolver = new Resolver();
const projectOf = (context) => context.extension.project.key;

resolver.define('getDesk', ({ context }) => getDesk(projectOf(context)));
resolver.define('saveBet', ({ payload, context }) => saveBet(projectOf(context), { ...payload, source: 'human' }));
resolver.define('saveSettings', ({ payload, context }) =>
  saveSettings(projectOf(context), Number(payload.capacity), Number(payload.lambda)));

export const handler = resolver.getDefinitions();
