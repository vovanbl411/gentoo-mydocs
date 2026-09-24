// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://vovanbl411.github.io',
	base: '/gentoo-mydocs',
	integrations: [
		starlight({
			title: 'Gentoo Linux Documentation',
			defaultLocale: 'root',
			locales: {
				root: { label: 'Русский', lang: 'ru' },
			},
		}),
	],
});
