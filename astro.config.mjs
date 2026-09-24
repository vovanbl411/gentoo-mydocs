// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	integrations: [
		starlight({
			title: 'Gentoo Linux Documentation',
			defaultLocale: 'ru',
			locales: {
				ru: { label: 'Русский', lang: 'ru' },
			},
		}),
	],
});
