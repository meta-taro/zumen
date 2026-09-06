import { mount } from 'svelte';

import App from './App.svelte';
import './tokens.css';

const target = document.getElementById('app');
if (target === null) throw new Error('#app が無い');

mount(App, { target });
