/**
 * ==================================================
 *   _____ _ _ _             _
 *  |     |_| | |___ ___ ___|_|_ _ _____
 *  | | | | | | | -_|   |   | | | |     |
 *  |_|_|_|_|_|_|___|_|_|_|_|_|___|_|_|_|
 *
 * ==================================================
 *
 * Copyright (c) 2026 Project Millennium
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

import { useState } from 'react';
import { DialogButton, IconsModule, joinClassNames, pluginSelf } from '@steambrew/client';
import { SettingsDialogSubHeader } from '../../components/SteamComponents';
import { formatString, locale, SteamLocale } from '../../utils/localization-manager';
import { UpdateCard, UpdateItemType } from './UpdateCard';
import { UpdateContextProviderState, useUpdateContext } from './useUpdateContext';
import { backend } from '../../utils/ffi';
import { ThemeItem } from '../../types';
import { Utils } from '../../utils';
import { waitForInstallerComplete } from '../general/Installer';
import { settingsClasses } from '../../utils/classes';
import { MillenniumIcons } from '../../components/Icons';

async function StartThemeUpdate(ctx: UpdateContextProviderState, updateObject: UpdateItemType) {
const key = updateObject.native;
const { setUpdatingTheme, setThemeProgress, fetchAvailableUpdates } = ctx;
if (ctx.updatingThemes[key]) return;

setUpdatingTheme(key, true);
setThemeProgress(key, { statusText: locale.strPreparing, progress: 0 });

const result = await backend.themes.update(updateObject.native);
const opId: number = result?.opId ?? 0;

const updateSuccess = await waitForInstallerComplete(opId, ({ progress, status }) => {
setThemeProgress(key, { statusText: status, progress });
});

if (updateSuccess) {
setThemeProgress(key, { statusText: locale.strFinishedUpdating, progress: 100 });
await fetchAvailableUpdates(true);
const activeTheme: ThemeItem = pluginSelf.activeTheme;

if (activeTheme?.native === updateObject?.native) {
const reload = await Utils.ShowMessageBox(formatString(locale.updateSuccessfulRestart, updateObject?.name), SteamLocale('#Settings_RestartRequired_Title'));
reload && SteamClient.Browser.RestartJSContext();
}
} else {
Utils.ShowMessageBox(formatString(locale.updateFailed, updateObject?.name), SteamLocale('#Generic_Error'));
}

setUpdatingTheme(key, false);
setThemeProgress(key, null);
}

async function StartAllThemeUpdates(ctx: UpdateContextProviderState, themeUpdates: UpdateItemType[], setUpdatingAll: (v: boolean) => void) {
const { isAnyUpdating, fetchAvailableUpdates } = ctx;
if (isAnyUpdating()) return;

const confirmed = await Utils.ShowMessageBox(locale.strUpdateAllThemesConfirmBody, locale.strUpdateAllThemesConfirmTitle);
if (!confirmed) return;

setUpdatingAll(true);

const activeTheme: ThemeItem = pluginSelf.activeTheme;
let needsRestart = false;
let anyFailed = false;

for (const update of themeUpdates) {
const result = await backend.themes.update(update.native);
const opId: number = result?.opId ?? 0;
const success = await waitForInstallerComplete(opId, () => {});
if (!success) {
anyFailed = true;
} else if (activeTheme?.native === update?.native) {
needsRestart = true;
}
}

await fetchAvailableUpdates(true);
setUpdatingAll(false);

if (anyFailed) {
Utils.ShowMessageBox(formatString(locale.updateFailed, 'one or more themes'), SteamLocale('#Generic_Error'), { bAlertDialog: true });
return;
}

if (needsRestart) {
const themeName = themeUpdates.find((u) => u?.native === activeTheme?.native)?.name ?? activeTheme?.data?.name ?? '';
const reload = await Utils.ShowMessageBox(formatString(locale.updateSuccessfulRestart, themeName), SteamLocale('#Settings_RestartRequired_Title'));
reload && SteamClient.Browser.RestartJSContext();
}
}

export function ThemeUpdateCard({ themeUpdates }: { themeUpdates: UpdateItemType[] }) {
if (!themeUpdates || !themeUpdates.length) return null;

const ctx = useUpdateContext();
const [isUpdatingAll, setIsUpdatingAll] = useState(false);

return (
<>
<SettingsDialogSubHeader>{locale.settingsPanelThemes}</SettingsDialogSubHeader>
{themeUpdates.length > 1 && (
<DialogButton
className={joinClassNames(settingsClasses.SettingsDialogButton, 'MillenniumButton')}
onClick={() => StartAllThemeUpdates(ctx, themeUpdates, setIsUpdatingAll)}
disabled={isUpdatingAll || ctx.isAnyUpdating()}
>
{isUpdatingAll ? (
<>
<MillenniumIcons.LoadingSpinner />
{locale.strUpdateAllThemes}
</>
) : (
<>
<IconsModule.Download />
{locale.strUpdateAllThemes}
</>
)}
</DialogButton>
)}
{themeUpdates?.map((update: UpdateItemType, index: number) => (
<UpdateCard
update={update}
index={index}
totalCount={themeUpdates.length}
isUpdating={ctx.updatingThemes[update.native]}
progress={ctx.themeProgress[update.native]?.progress ?? 0}
statusText={ctx.themeProgress[update.native]?.statusText ?? ''}
onUpdateClick={() => StartThemeUpdate(ctx, update)}
/>
))}
</>
);
}
