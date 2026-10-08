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
				en: { label: 'English', lang: 'en' },
			},
			sidebar: [
				{
					slug: 'index',
					label: 'Главная',
					translations: { en: 'Home' },
				},
				{
					label: 'Установка',
					translations: { en: 'Installation' },
					items: [
						{ slug: 'installation/gentoo-installation' },
						{ slug: 'installation/base-system' },
						{ slug: 'installation/systemd-uki-setup' },
						{ slug: 'installation/secure-boot-tpm' },
					],
				},
				{ slug: 'managed/portage', label: 'Portage' },
				{
					label: 'Рабочий стол',
					translations: { en: 'Desktop' },
					items: [
						{ slug: 'desktop/niri', label: 'Niri' },
						{ slug: 'desktop/noctalia-shell', label: 'Noctalia' },
						{ slug: 'desktop/notifications', label: 'Уведомления', translations: { en: 'Notifications' } },
						{ slug: 'desktop/wayland-portals', label: 'XDG Desktop Portals' },
						{
							slug: 'desktop/default-applications',
							label: 'Приложения по умолчанию',
							translations: { en: 'Default applications' },
						},
					],
				},
				{
					label: 'Файловая система',
					translations: { en: 'Filesystem' },
					items: [
						{ slug: 'filesystem/btrfs-setup', label: 'Btrfs' },
						{ slug: 'filesystem/snapper-backups', label: 'Snapper / backups' },
					],
				},
				{
					label: 'Оборудование',
					translations: { en: 'Hardware' },
					items: [
						{ slug: 'hardware/intel-graphics', label: 'Intel Graphics' },
						{
							slug: 'hardware/elan-fingerprint-04f3-0c77',
							label: 'ELAN fingerprint 04f3:0c77',
						},
					],
				},
				{
					label: 'Сеть',
					translations: { en: 'Networking' },
					items: [
						{ slug: 'networking/networkmanager-iwd', label: 'NetworkManager + iwd' },
						{ slug: 'networking/wireless-regulatory', label: 'Wireless regulatory domain' },
						{ slug: 'networking/nftables-firewall', label: 'nftables firewall' },
					],
				},
				{
					label: 'Безопасность',
					translations: { en: 'Security' },
					items: [
						{ slug: 'security/kernel-hardening', label: 'Kernel hardening' },
						{ slug: 'security/app-armor', label: 'AppArmor' },
						{ slug: 'security/auditd', label: 'Auditd' },
						{ slug: 'security/usbguard', label: 'USBGuard' },
						{ slug: 'security/doas-configuration', label: 'doas' },
					],
				},
				{
					label: 'Приложения и настройки',
					translations: { en: 'Applications & settings' },
					collapsed: true,
					items: [{ autogenerate: { directory: 'settings' } }],
				},
				{
					label: 'Решение проблем',
					translations: { en: 'Troubleshooting' },
					collapsed: true,
					items: [{ autogenerate: { directory: 'troubleshooting' } }],
				},
				{
					label: 'ASUS ExpertBook B5402',
					collapsed: true,
					items: [
						{
							slug: 'systems/asus-b5402',
							label: 'Обзор системы',
							translations: { en: 'System overview' },
						},
						{
							slug: 'systems/asus-b5402/applications',
							label: 'Приложения',
							translations: { en: 'Applications' },
						},
						{ label: 'Рабочий стол', translations: { en: 'Desktop' }, items: [{ autogenerate: { directory: 'systems/asus-b5402/desktop' } }] },
						{ label: 'Файловая система', translations: { en: 'Filesystem' }, items: [{ autogenerate: { directory: 'systems/asus-b5402/filesystem' } }] },
						{ label: 'Оборудование', translations: { en: 'Hardware' }, items: [{ autogenerate: { directory: 'systems/asus-b5402/hardware' } }] },
						{ label: 'Сеть', translations: { en: 'Networking' }, items: [{ autogenerate: { directory: 'systems/asus-b5402/networking' } }] },
						{ label: 'Безопасность', translations: { en: 'Security' }, items: [{ autogenerate: { directory: 'systems/asus-b5402/security' } }] },
						{ label: 'Система', translations: { en: 'System' }, items: [{ autogenerate: { directory: 'systems/asus-b5402/system' } }] },
					],
				},
				{
					slug: 'systems/gentoo-builder-01',
					label: 'Gentoo Builder VM',
				},
				{
					label: 'Исследования',
					translations: { en: 'Research' },
					collapsed: true,
					items: [
						{ label: 'LLVM 23 toolchain', items: [{ autogenerate: { directory: 'experiments/llvm23-toolchain' } }] },
					],
				},
			],
		}),
	],
});
