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
			sidebar: [
				{ slug: 'index', label: 'Главная' },
				{
					label: 'Установка',
					items: [
						{ slug: 'installation/base-system' },
						{ slug: 'installation/systemd-uki-setup' },
						{ slug: 'installation/secure-boot-tpm' },
					],
				},
				{ slug: 'managed/portage', label: 'Portage' },
				{
					label: 'Рабочий стол',
					items: [
						{ slug: 'desktop/niri', label: 'Niri' },
						{ slug: 'desktop/noctalia-shell', label: 'Noctalia' },
						{ slug: 'desktop/wayland-portals', label: 'XDG Desktop Portals' },
						{ slug: 'desktop/default-applications', label: 'Приложения по умолчанию' },
					],
				},
				{
					label: 'Файловая система',
					items: [
						{ slug: 'filesystem/btrfs-setup', label: 'Btrfs' },
						{ slug: 'filesystem/snapper-backups', label: 'Snapper / backups' },
					],
				},
				{ slug: 'hardware/intel-graphics', label: 'Оборудование' },
				{
					label: 'Сеть',
					items: [
						{ slug: 'networking/networkmanager-iwd', label: 'NetworkManager + iwd' },
						{ slug: 'networking/wireless-regulatory', label: 'Wireless regulatory domain' },
						{ slug: 'networking/nftables-firewall', label: 'nftables firewall' },
					],
				},
				{
					label: 'Безопасность',
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
					collapsed: true,
					items: [{ autogenerate: { directory: 'settings' } }],
				},
				{
					label: 'Решение проблем',
					collapsed: true,
					items: [{ autogenerate: { directory: 'troubleshooting' } }],
				},
				{
					label: 'ASUS ExpertBook B5402',
					collapsed: true,
					items: [
						{ slug: 'systems/asus-b5402', label: 'Обзор системы' },
						{ slug: 'systems/asus-b5402/applications', label: 'Приложения' },
						{ label: 'Рабочий стол', items: [{ autogenerate: { directory: 'systems/asus-b5402/desktop' } }] },
						{ label: 'Файловая система', items: [{ autogenerate: { directory: 'systems/asus-b5402/filesystem' } }] },
						{ label: 'Оборудование', items: [{ autogenerate: { directory: 'systems/asus-b5402/hardware' } }] },
						{ label: 'Сеть', items: [{ autogenerate: { directory: 'systems/asus-b5402/networking' } }] },
						{ label: 'Безопасность', items: [{ autogenerate: { directory: 'systems/asus-b5402/security' } }] },
						{ label: 'Система', items: [{ autogenerate: { directory: 'systems/asus-b5402/system' } }] },
					],
				},
				{
					label: 'Исследования',
					collapsed: true,
					items: [
						{ label: 'LLVM 23 toolchain', items: [{ autogenerate: { directory: 'experiments/llvm23-toolchain' } }] },
						{ label: 'ELAN fingerprint 04f3:0c77', items: [{ autogenerate: { directory: 'experiments/elan-fingerprint-04f3-0c77' } }] },
					],
				},
			],
		}),
	],
});
