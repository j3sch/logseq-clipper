import browser from './browser-polyfill';
import { Settings, ModelConfig, PropertyType, HistoryEntry, Provider } from '../types/types';
import { debugLog } from './debug';

export type { Settings, ModelConfig, PropertyType, HistoryEntry, Provider };

export let generalSettings: Settings = {
	vaults: [],
	betaFeatures: false,
	legacyMode: false,
	silentOpen: false,
	highlighterEnabled: true,
	alwaysShowHighlights: false,
	highlightBehavior: 'replace-content',
	showMoreActionsButton: false,
	interpreterModel: 'gpt-4o-mini',
	models: [
		{ id: 'gpt-4o-mini', providerId: 'openai', providerModelId: 'gpt-4o-mini', name: 'GPT-4o Mini', enabled: true },
		{ id: 'gpt-4o', providerId: 'openai', providerModelId: 'gpt-4o', name: 'GPT-4o', enabled: true },
		{ id: 'claude-3-5-sonnet-latest', providerId: 'anthropic', providerModelId: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', enabled: true },
		{ id: 'claude-3-5-haiku-latest', providerId: 'anthropic', providerModelId: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', enabled: true },
	],
	providers: [
		{
			id: 'openai',
			name: 'OpenAI',
			baseUrl: 'https://api.openai.com/v1/chat/completions',
			apiKey: ''
		},
		{
			id: 'anthropic',
			name: 'Anthropic',
			baseUrl: 'https://api.anthropic.com/v1/messages',
			apiKey: ''
		}
	],
	interpreterEnabled: false,
	interpreterAutoRun: false,
	defaultPromptContext: '',
	propertyTypes: [],
	stats: {
		addToObsidian: 0,
		saveFile: 0,
		copyToClipboard: 0,
		share: 0
	},
	history: []
};

export function setLocalStorage(key: string, value: any): Promise<void> {
	return browser.storage.local.set({ [key]: value });
}

export function getLocalStorage(key: string): Promise<any> {
	return browser.storage.local.get(key).then((result: { [key: string]: any }) => result[key]);
}

interface StorageData {
	general_settings?: {
		showMoreActionsButton?: boolean;
		betaFeatures?: boolean;
		legacyMode?: boolean;
		silentOpen?: boolean;
	};
	vaults?: string[];
	highlighter_settings?: {
		highlighterEnabled?: boolean;
		alwaysShowHighlights?: boolean;
		highlightBehavior?: string;
	};
	interpreter_settings?: {
		interpreterModel?: string;
		models?: ModelConfig[];
		providers?: Provider[];
		interpreterEnabled?: boolean;
		interpreterAutoRun?: boolean;
		defaultPromptContext?: string;
	};
	property_types?: PropertyType[];
	stats?: {
		addToObsidian: number;
		saveFile: number;
		copyToClipboard: number;
		share: number;
	};
	history?: HistoryEntry[];
}

interface LegacyModelConfig {
	id: string;
	name: string;
	provider?: string;
	providerId?: string;
	baseUrl?: string;
	apiKey?: string;
	enabled: boolean;
	providerModelId?: string;
}

interface LegacyInterpreterSettings {
	openaiApiKey?: string;
	anthropicApiKey?: string;
	interpreterModel?: string;
	models?: LegacyModelConfig[];
	providers?: Provider[];
	interpreterEnabled?: boolean;
	interpreterAutoRun?: boolean;
	defaultPromptContext?: string;
}

interface LegacyStorageData {
	general_settings?: {
		showMoreActionsButton?: boolean;
		betaFeatures?: boolean;
		legacyMode?: boolean;
		silentOpen?: boolean;
	};
	vaults?: string[];
	highlighter_settings?: {
		highlighterEnabled?: boolean;
		alwaysShowHighlights?: boolean;
		highlightBehavior?: string;
	};
	interpreter_settings?: LegacyInterpreterSettings;
	property_types?: PropertyType[];
	stats?: {
		addToObsidian: number;
		saveFile: number;
		copyToClipboard: number;
		share: number;
	};
	history?: HistoryEntry[];
	openaiApiKey?: string;
	anthropicApiKey?: string;
	openaiModel?: string;
	migrationVersion?: number;
}

const CURRENT_MIGRATION_VERSION = 1;

async function needsMigration(data: LegacyStorageData): Promise<boolean> {
	// Check if migration has already been run
	if (data.migrationVersion === CURRENT_MIGRATION_VERSION) {
		return false;
	}

	// Check for presence of legacy API key fields
	return !!(data.anthropicApiKey ||
		data.openaiApiKey ||
		data.interpreter_settings?.anthropicApiKey ||
		data.interpreter_settings?.openaiApiKey ||
		data.interpreter_settings?.models?.some(m => m.provider || m.apiKey));
}

async function migrateModelsAndProviders(data: LegacyStorageData): Promise<{ models: ModelConfig[], providers: Provider[] }> {
	debugLog('Migration', 'Starting models and providers migration');

	try {
		// Start with default providers from generalSettings
		const defaultProviders = generalSettings.providers.map(provider => ({
			...provider,
			// Migrate API keys if they exist
			apiKey: provider.id === 'openai'
				? (data.openaiApiKey || data.interpreter_settings?.openaiApiKey || provider.apiKey)
				: provider.id === 'anthropic'
					? (data.anthropicApiKey || data.interpreter_settings?.anthropicApiKey || provider.apiKey)
					: provider.apiKey
		}));

		// Create a map to track custom providers
		const customProviders = new Map<string, Provider>();

		// Get legacy models
		const legacyModels = data.interpreter_settings?.models || [];

		// First pass: collect all unique custom providers
		legacyModels.forEach((model) => {
			if (model.provider &&
				!customProviders.has(model.provider) &&
				!defaultProviders.some(p => p.name === model.provider) &&
				model.provider !== 'OpenAI' &&
				model.provider !== 'Anthropic') {

				const providerId = model.provider.toLowerCase().replace(/\s+/g, '-');
				const newProvider: Provider = {
					id: providerId,
					name: model.provider,
					baseUrl: model.baseUrl || '',
					apiKey: model.apiKey || ''
				};
				customProviders.set(model.provider, newProvider);
				debugLog('Migration', `Created custom provider: ${model.provider}`);
			}
		});

		// Combine default and custom providers
		const allProviders = [...defaultProviders, ...Array.from(customProviders.values())];

		// Create migrated models with correct structure
		const models: ModelConfig[] = legacyModels.map((model): ModelConfig => {
			let providerId = '';

			// Match provider based on name or model name
			if (model.provider === 'OpenAI' || model.name.toLowerCase().includes('gpt')) {
				providerId = 'openai';
			} else if (model.provider === 'Anthropic' || model.name.toLowerCase().includes('claude')) {
				providerId = 'anthropic';
			} else if (model.provider) {
				const customProvider = customProviders.get(model.provider);
				providerId = customProvider?.id || model.provider.toLowerCase().replace(/\s+/g, '-');
			}

			// Only keep the fields we need in the new model structure
			return {
				id: model.id,
				name: model.name,
				providerId: providerId,
				providerModelId: model.id,
				enabled: model.enabled
			};
		});

		// If no models exist, use default models from generalSettings
		if (models.length === 0) {
			models.push(...generalSettings.models);
		}

		// Clean up legacy fields
		await browser.storage.sync.remove([
			'anthropicApiKey',
			'openaiApiKey',
			'openaiModel'
		]);

		// Save migration version
		await browser.storage.sync.set({ migrationVersion: CURRENT_MIGRATION_VERSION });

		debugLog('Migration', `Migrated ${models.length} models and ${allProviders.length} providers`);

		return {
			models,
			providers: allProviders
		};
	} catch (error) {
		console.error('Migration failed:', error);
		debugLog('Migration', 'Migration failed:', error);
		throw error;
	}
}

export async function loadSettings(): Promise<Settings> {
	const data = await browser.storage.sync.get(null) as LegacyStorageData;

	// Load default settings first
	const defaultSettings: Settings = {
		vaults: [],
		showMoreActionsButton: false,
		betaFeatures: false,
		legacyMode: false,
		silentOpen: false,
		highlighterEnabled: true,
		alwaysShowHighlights: true,
		highlightBehavior: 'replace-content',
		interpreterModel: 'gpt-4o-mini',
		models: [],
		providers: [],
		interpreterEnabled: false,
		interpreterAutoRun: false,
		defaultPromptContext: '',
		propertyTypes: [],
		stats: {
			addToObsidian: 0,
			saveFile: 0,
			copyToClipboard: 0,
			share: 0
		},
		history: []
	};

	if (await needsMigration(data)) {
		debugLog('Settings', 'Starting migration...');
		try {
			const { models, providers } = await migrateModelsAndProviders(data);
			data.interpreter_settings = {
				...data.interpreter_settings,
				models,
				providers
			};
			debugLog('Settings', 'Migration completed');
		} catch (error) {
			console.error('Migration failed:', error);
			debugLog('Settings', 'Migration failed, using default settings');
		}
	}

	// Load user settings
	const loadedSettings: Settings = {
		vaults: data.vaults || defaultSettings.vaults,
		showMoreActionsButton: data.general_settings?.showMoreActionsButton ?? defaultSettings.showMoreActionsButton,
		betaFeatures: data.general_settings?.betaFeatures ?? defaultSettings.betaFeatures,
		legacyMode: data.general_settings?.legacyMode ?? defaultSettings.legacyMode,
		silentOpen: data.general_settings?.silentOpen ?? defaultSettings.silentOpen,
		highlighterEnabled: data.highlighter_settings?.highlighterEnabled ?? defaultSettings.highlighterEnabled,
		alwaysShowHighlights: data.highlighter_settings?.alwaysShowHighlights ?? defaultSettings.alwaysShowHighlights,
		highlightBehavior: data.highlighter_settings?.highlightBehavior ?? defaultSettings.highlightBehavior,
		interpreterModel: data.interpreter_settings?.interpreterModel || defaultSettings.interpreterModel,
		models: (data.interpreter_settings?.models as ModelConfig[]) || defaultSettings.models,
		providers: data.interpreter_settings?.providers || defaultSettings.providers,
		interpreterEnabled: data.interpreter_settings?.interpreterEnabled ?? defaultSettings.interpreterEnabled,
		interpreterAutoRun: data.interpreter_settings?.interpreterAutoRun ?? defaultSettings.interpreterAutoRun,
		defaultPromptContext: data.interpreter_settings?.defaultPromptContext || defaultSettings.defaultPromptContext,
		propertyTypes: data.property_types || defaultSettings.propertyTypes,
		stats: data.stats || defaultSettings.stats,
		history: data.history || defaultSettings.history
	};

	generalSettings = loadedSettings;
	debugLog('Settings', 'Loaded settings:', generalSettings);
	return generalSettings;
}

export async function saveSettings(settings?: Partial<Settings>): Promise<void> {
	if (settings) {
		generalSettings = { ...generalSettings, ...settings };
	}

	await browser.storage.sync.set({
		vaults: generalSettings.vaults,
		general_settings: {
			showMoreActionsButton: generalSettings.showMoreActionsButton,
			betaFeatures: generalSettings.betaFeatures,
			legacyMode: generalSettings.legacyMode,
			silentOpen: generalSettings.silentOpen
		},
		highlighter_settings: {
			highlighterEnabled: generalSettings.highlighterEnabled,
			alwaysShowHighlights: generalSettings.alwaysShowHighlights,
			highlightBehavior: generalSettings.highlightBehavior
		},
		interpreter_settings: {
			interpreterModel: generalSettings.interpreterModel,
			models: generalSettings.models,
			providers: generalSettings.providers,
			interpreterEnabled: generalSettings.interpreterEnabled,
			interpreterAutoRun: generalSettings.interpreterAutoRun,
			defaultPromptContext: generalSettings.defaultPromptContext
		},
		property_types: generalSettings.propertyTypes,
		stats: generalSettings.stats
	});
}

export async function setLegacyMode(enabled: boolean): Promise<void> {
	await saveSettings({ legacyMode: enabled });
	console.log(`Legacy mode ${enabled ? 'enabled' : 'disabled'}`);
}

export async function incrementStat(
	action: keyof Settings['stats'],
): Promise<void> {
	const settings = await loadSettings();
	settings.stats[action]++;
	await saveSettings(settings);

	// Get the current tab's URL and title
	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	if (tabs[0]?.url) {
		await addHistoryEntry(action, tabs[0].url, tabs[0].title);
	}
}

export async function addHistoryEntry(
	action: keyof Settings['stats'],
	url: string,
	title?: string,
): Promise<void> {
	const entry: HistoryEntry = {
		datetime: new Date().toISOString(),
		url,
		action,
		title,
	};

	// Get existing history from local storage
	const result = await browser.storage.local.get('history');
	const history: HistoryEntry[] = (result.history || []) as HistoryEntry[];

	// Add new entry at the beginning
	history.unshift(entry);

	// Keep only the last 1000 entries
	const trimmedHistory = history.slice(0, 1000);

	// Save back to local storage
	await browser.storage.local.set({ history: trimmedHistory });
}

export async function getClipHistory(): Promise<HistoryEntry[]> {
	const result = await browser.storage.local.get('history');
	return (result.history || []) as HistoryEntry[];
}

declare global {
	interface Window {
		debugStorage: (key?: string) => Promise<Record<string, unknown>>;
	}
}

// Make storage accessible from console — use `window.debugStorage()` to see all sync storage, or `window.debugStorage(key)` to see a specific key
window.debugStorage = (key?: string) => {
	if (key) {
		return browser.storage.sync.get(key).then(data => {
			console.log(`Sync storage contents for key "${key}":`, data);
			return data;
		});
	}
	return browser.storage.sync.get(null).then(data => {
		console.log('Sync storage contents:', data);
		return data;
	});
};
