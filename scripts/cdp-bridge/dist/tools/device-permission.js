import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { okResult, failResult } from '../utils.js';
const execFileAsync = promisify(execFile);
const EXEC_TIMEOUT = 10_000;
const IOS_PERMISSIONS = {
    notifications: 'notifications',
    camera: 'camera',
    microphone: 'microphone',
    location: 'location',
    'location-always': 'location-always',
    photos: 'photos',
    contacts: 'contacts',
    calendar: 'calendars',
    reminders: 'reminders',
    all: 'all',
};
const ANDROID_PERMISSIONS = {
    notifications: 'android.permission.POST_NOTIFICATIONS',
    camera: 'android.permission.CAMERA',
    microphone: 'android.permission.RECORD_AUDIO',
    location: 'android.permission.ACCESS_FINE_LOCATION',
    'location-always': 'android.permission.ACCESS_BACKGROUND_LOCATION',
    photos: 'android.permission.READ_MEDIA_IMAGES',
    contacts: 'android.permission.READ_CONTACTS',
    calendar: 'android.permission.READ_CALENDAR',
    storage: 'android.permission.READ_EXTERNAL_STORAGE',
};
async function detectPlatform() {
    try {
        const { stdout } = await execFileAsync('xcrun', ['simctl', 'list', 'devices', 'booted'], { timeout: EXEC_TIMEOUT });
        if (stdout.includes('Booted'))
            return 'ios';
    }
    catch { /* no iOS */ }
    try {
        const { stdout } = await execFileAsync('adb', ['devices'], { timeout: EXEC_TIMEOUT });
        if (/\tdevice$/m.test(stdout))
            return 'android';
    }
    catch { /* no Android */ }
    return null;
}
async function iosPermission(action, permission, appId) {
    const iosKey = IOS_PERMISSIONS[permission];
    if (!iosKey) {
        const valid = Object.keys(IOS_PERMISSIONS).join(', ');
        return failResult(`Unknown iOS permission: "${permission}". Valid: ${valid}`);
    }
    try {
        const args = ['simctl', 'privacy', 'booted', action, iosKey, appId];
        const { stdout, stderr } = await execFileAsync('xcrun', args, { timeout: EXEC_TIMEOUT });
        return okResult({
            platform: 'ios',
            action,
            permission: iosKey,
            appId,
            output: (stdout || stderr).trim(),
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return failResult(`xcrun simctl privacy failed: ${msg}`);
    }
}
async function androidPermission(action, permission, appId) {
    if (action === 'reset') {
        try {
            const { stdout } = await execFileAsync('adb', ['shell', 'pm', 'reset-permissions', appId], { timeout: EXEC_TIMEOUT });
            return okResult({ platform: 'android', action: 'reset', appId, output: stdout.trim() });
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return failResult(`adb pm reset-permissions failed: ${msg}`);
        }
    }
    const androidKey = ANDROID_PERMISSIONS[permission];
    if (!androidKey) {
        const valid = Object.keys(ANDROID_PERMISSIONS).join(', ');
        return failResult(`Unknown Android permission: "${permission}". Valid: ${valid}`);
    }
    const adbAction = action === 'grant' ? 'grant' : 'revoke';
    try {
        const { stdout, stderr } = await execFileAsync('adb', ['shell', 'pm', adbAction, appId, androidKey], { timeout: EXEC_TIMEOUT });
        return okResult({
            platform: 'android',
            action: adbAction,
            permission: androidKey,
            appId,
            output: (stdout || stderr).trim(),
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return failResult(`adb pm ${adbAction} failed: ${msg}`);
    }
}
export function createDevicePermissionHandler() {
    return async (args) => {
        const platform = args.platform || await detectPlatform();
        if (!platform)
            return failResult('No iOS simulator or Android device detected');
        if (platform === 'ios')
            return iosPermission(args.action, args.permission, args.appId);
        return androidPermission(args.action, args.permission, args.appId);
    };
}
