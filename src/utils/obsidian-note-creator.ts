import browser from './browser-polyfill';
import { escapeDoubleQuotes, sanitizeFileName } from '../utils/string-utils';
import { Template, Property } from '../types/types';
import { generalSettings, incrementStat } from './storage-utils';
import { copyToClipboard } from './clipboard-utils';
import { getMessage } from './i18n';

export async function generateFrontmatter(properties: Property[]): Promise<string> {
	let frontmatter = '\u200B\n';
	for (const property of properties) {
		frontmatter += `${property.name}::`; // Use double colons for Logseq format

		const propertyType = generalSettings.propertyTypes.find(p => p.name === property.name)?.type || 'text';

		switch (propertyType) {
			case 'multitext':
				if (property.name === 'tags') {
					const tags = property.value
						.split(' ')
						.map(tag => tag.replace(/,/g, '').trim())
						.filter(tag => tag !== '');
					if (tags.length > 0) {
						const formattedTags = tags.map(tag => `${tag}`).join(',');
						frontmatter += ` ${formattedTags}\n`;
					} else {
						frontmatter += '\n';
					}
					break;
				}
				let items: string[];
				if (property.value.trim().startsWith('["') && property.value.trim().endsWith('"]')) {
					try {
						items = JSON.parse(property.value);
					} catch (e) {
						// If parsing fails, fall back to splitting by comma
						items = property.value.split(',').map(item => item.trim());
					}
				} else {
					// Split by comma, but keep wikilinks intact
					items = property.value.split(/,(?![^\[]*\]\])/).map(item => item.trim());
				}
				items = items.filter(item => item !== '');
				if (items.length > 0) {
					items.forEach(item => {
						frontmatter += ` ${escapeDoubleQuotes(item)}`;
					});
				}
				frontmatter += '\n';
				break;
			case 'number':
				const numericValue = property.value.replace(/[^\d.-]/g, '');
				frontmatter += numericValue ? ` ${parseFloat(numericValue)}\n` : '\n';
				break;
			case 'checkbox':
				const isChecked = typeof property.value === 'boolean' ? property.value : property.value === 'true';
				frontmatter += ` ${isChecked}\n`;
				break;
			case 'date':
			case 'datetime':
				if (property.value.trim() !== '') {
					frontmatter += ` ${property.value}\n`;
				} else {
					frontmatter += '\n';
				}
				break;
			default: // Text
				frontmatter += property.value.trim() !== '' ? ` "${escapeDoubleQuotes(property.value)}"\n` : '\n';
		}
	}

	// Check if the frontmatter is empty
	if (frontmatter.trim() === '\u200B') {
		return '';
	}

	return frontmatter;
}

function openObsidianUrl(url: string): void {
	browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
		const currentTab = tabs[0];
		if (currentTab && currentTab.id) {
			browser.tabs.update(currentTab.id, { url: url });
		}
	});
}

async function tryClipboardWrite(fileContent: string, obsidianUrl: string): Promise<void> {
	const success = await copyToClipboard(fileContent);

	if (success) {
		// &clipboard tells the app to read data from clipboard instead of the content param.
		obsidianUrl += `&clipboard&content=${encodeURIComponent(getMessage('clipboardError', 'https://help.obsidian.md/web-clipper/troubleshoot'))}`;
		openObsidianUrl(obsidianUrl);
		console.log('Logseq URL:', obsidianUrl);
	} else {
		console.error('All clipboard methods failed, falling back to URI method');
		// Final fallback: use URI method with actual content (same as legacy mode)
		obsidianUrl += `&content=${encodeURIComponent(fileContent)}`;
		openObsidianUrl(obsidianUrl);
		console.log('Logseq URL (URI fallback):', obsidianUrl);
	}
}

export async function saveToObsidian(
	fileContent: string,
	noteName: string,
	behavior: Template['behavior'],
): Promise<void> {
	let obsidianUrl: string;

	const isDailyNote = behavior === 'append-daily' || behavior === 'prepend-daily';

	if (isDailyNote) {
		obsidianUrl = `logseq://x-callback-url/quickCapture?page=TODAY&append=true`;
	} else {
		const formattedNoteName = sanitizeFileName(noteName);
		obsidianUrl = `logseq://x-callback-url/quickCapture?page=${formattedNoteName}`;
	}

	// Add silent parameter if silentOpen is enabled
	if (generalSettings.silentOpen) {
		obsidianUrl += '&silent=true';
	}

	if (generalSettings.legacyMode) {
		// Use the URI method
		obsidianUrl += `&content=${encodeURIComponent(fileContent)}`;
		console.log('Logseq URL:', obsidianUrl);
		openObsidianUrl(obsidianUrl);
	} else {
		// Try to copy to clipboard with fallback mechanisms
		await tryClipboardWrite(fileContent, obsidianUrl);
	}
}
