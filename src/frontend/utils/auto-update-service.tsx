/**
 * ==================================================
 *   _____ _ _ _             _
 *  |     |_| | |___ ___ ___|_|_ _ _____
 *  | | | | | | | -_|   |   | | | |     |
 *  |_|_|_|_|_|_|___|_|_|_|_|_|___|_|_|_|
 *
 * ==================================================
 *
 * Copyright (c) 2025 Project Millennium
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { IconsModule, pluginSelf, sleep, toaster } from '@steambrew/client';
import { PyFindAllPlugins, PyUpdatePlugin, PyUpdatePluginStatus, PyUpdateTheme } from './ffi';
import { settingsManager } from './settings-manager';
import { Logger } from './Logger';
import { ThemeItem } from '../types';

/**
 * Runs silently on startup when the user has opted in to auto-update plugins and themes.
 * - Non-active themes are updated silently.
 * - Active theme is updated and a restart toast is shown if needed.
 * - Enabled plugins are temporarily disabled, updated, then re-enabled, followed by a JS context restart.
 */
export class AutoUpdateService {
async run(): Promise<void> {
await sleep(5000); // Let the rest of the startup sequence complete first

if (!settingsManager.config?.general?.autoUpdatePluginsAndThemesOnStartup) {
Logger.Log('Auto-update on startup is disabled, skipping.');
return;
}

const themeUpdates: any[] = pluginSelf?.updates?.themes ?? [];
const pluginUpdatesRaw: any[] = pluginSelf?.updates?.plugins ?? [];
const pluginUpdates = pluginUpdatesRaw.filter((u: any) => u?.hasUpdate);

const hasThemeUpdates = themeUpdates.length > 0;
const hasPluginUpdates = pluginUpdates.length > 0;

if (!hasThemeUpdates && !hasPluginUpdates) {
Logger.Log('Auto-update: no plugin or theme updates available.');
return;
}

Logger.Log(`Auto-update: applying ${themeUpdates.length} theme(s) and ${pluginUpdates.length} plugin(s).`);

let needsRestart = false;

// --- Update themes ---
if (hasThemeUpdates) {
const activeTheme: ThemeItem = pluginSelf.activeTheme;

for (const update of themeUpdates) {
try {
const success = await PyUpdateTheme({ native: update.native });
if (success && activeTheme?.native === update?.native) {
needsRestart = true;
}
} catch (e) {
Logger.Warn(`Auto-update: failed to update theme "${update?.name}":`, e);
}
}
}

// --- Update plugins ---
if (hasPluginUpdates) {
const allPlugins = JSON.parse(await PyFindAllPlugins());
const enabledPluginNames: string[] = pluginUpdates
.map((u: any) => u?.pluginInfo?.pluginJson?.name)
.filter((name: string) => allPlugins.find((p: any) => p.data.name === name)?.enabled);

// Disable enabled plugins before updating
if (enabledPluginNames.length > 0) {
const disableList = enabledPluginNames.map((name) => ({ plugin_name: name, enabled: false }));
await PyUpdatePluginStatus({ pluginJson: JSON.stringify(disableList) });
}

for (const update of pluginUpdates) {
try {
await PyUpdatePlugin({ id: update?.id, name: update?.pluginDirectory });
} catch (e) {
Logger.Warn(`Auto-update: failed to update plugin "${update?.pluginInfo?.pluginJson?.common_name}":`, e);
}
}

// Re-enable the previously enabled plugins
if (enabledPluginNames.length > 0) {
const enableList = enabledPluginNames.map((name) => ({ plugin_name: name, enabled: true }));
await PyUpdatePluginStatus({ pluginJson: JSON.stringify(enableList) });
}

needsRestart = true;
}

if (needsRestart) {
const totalCount = themeUpdates.length + pluginUpdates.length;
toaster.toast({
title: 'Updates Applied',
body: `${totalCount} update${totalCount === 1 ? '' : 's'} applied. Restarting Steam...`,
logo: <IconsModule.Download />,
});

await sleep(3000);
SteamClient.Browser.RestartJSContext();
} else if (hasThemeUpdates) {
toaster.toast({
title: 'Themes Updated',
body: `${themeUpdates.length} theme${themeUpdates.length === 1 ? '' : 's'} updated successfully.`,
logo: <IconsModule.Download />,
});
}
}
}
