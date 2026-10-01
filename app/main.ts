import { mount } from 'svelte';

import { messages } from '../src/messages.ts';
import App from './App.svelte';
import './tokens.css';

const target = document.getElementById('app');
if (target === null) throw new Error(messages().app.mountTargetMissing);

mount(App, { target });
