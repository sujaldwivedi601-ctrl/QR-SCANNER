import { AutomationSettings, PhoneNumberUsage } from '../types';

const STORAGE_KEYS = {
  PHONE_NUMBERS: 'qr_flow_phone_numbers',
  SETTINGS: 'qr_flow_settings',
  SELECTED_FOLDER_NAME: 'qr_flow_selected_folder',
  ONBOARDING_COMPLETED: 'qr_flow_onboarding_done',
};

const DEFAULT_SETTINGS: AutomationSettings = {
  batchLimit: 10,
  otpTimeoutSeconds: 60,
  maxRetries: 2,
  rotationStrategy: 'sequential',
  humanOtpFallback: true,
  autoRotateOnLimit: true,
  allowAiVisionFallback: true,
  testModePortal: false,
};

export function loadSettings(): AutomationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AutomationSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings to localStorage:', err);
  }
}

export function loadPhoneNumbers(): PhoneNumberUsage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PHONE_NUMBERS);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePhoneNumbers(numbers: PhoneNumberUsage[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PHONE_NUMBERS, JSON.stringify(numbers));
  } catch (err) {
    console.error('Failed to save phone numbers to localStorage:', err);
  }
}

export function getActivePhoneNumber(numbers: PhoneNumberUsage[]): PhoneNumberUsage | undefined {
  // First check explicitly marked 'active' that hasn't reached limit
  const active = numbers.find((n) => n.status === 'active' && n.usageCount < n.maxLimit);
  if (active) return active;

  // Otherwise pick first available that hasn't reached limit
  return numbers.find((n) => n.status === 'available' && n.usageCount < n.maxLimit);
}

export function rotateToNextPhoneNumber(
  numbers: PhoneNumberUsage[],
  currentId?: string,
  reason: 'limit_reached' | 'normal' = 'normal'
): { updatedNumbers: PhoneNumberUsage[]; nextNumber?: PhoneNumberUsage } {
  const list = numbers.map((n) => ({ ...n }));
  const currentIndex = list.findIndex((n) => n.id === currentId);

  if (currentIndex !== -1 && reason === 'limit_reached') {
    list[currentIndex].status = 'limit_reached';
  } else if (currentIndex !== -1) {
    list[currentIndex].status = 'available';
  }

  // Find candidate for next active
  const candidateIndex = list.findIndex(
    (n, idx) => idx !== currentIndex && n.status !== 'limit_reached' && n.status !== 'disabled' && n.usageCount < n.maxLimit
  );

  let nextNumber: PhoneNumberUsage | undefined;
  if (candidateIndex !== -1) {
    list[candidateIndex].status = 'active';
    nextNumber = list[candidateIndex];
  }

  savePhoneNumbers(list);
  return { updatedNumbers: list, nextNumber };
}

export function incrementPhoneUsage(
  numbers: PhoneNumberUsage[],
  phoneId: string
): { updatedNumbers: PhoneNumberUsage[]; isLimitReached: boolean } {
  let isLimitReached = false;
  const list = numbers.map((item) => {
    if (item.id === phoneId) {
      const newCount = item.usageCount + 1;
      const reached = newCount >= item.maxLimit;
      if (reached) isLimitReached = true;
      return {
        ...item,
        usageCount: newCount,
        status: reached ? ('limit_reached' as const) : item.status,
        lastUsedAt: new Date().toISOString(),
      };
    }
    return item;
  });

  savePhoneNumbers(list);
  return { updatedNumbers: list, isLimitReached };
}

export function getSavedFolderName(): string {
  return localStorage.getItem(STORAGE_KEYS.SELECTED_FOLDER_NAME) || '';
}

export function saveFolderName(name: string): void {
  localStorage.setItem(STORAGE_KEYS.SELECTED_FOLDER_NAME, name);
}

export function isOnboardingCompleted(): boolean {
  return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED) === 'true';
}

export function setOnboardingCompleted(completed: boolean): void {
  localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, completed ? 'true' : 'false');
}

export function clearAllLocalData(): void {
  localStorage.removeItem(STORAGE_KEYS.PHONE_NUMBERS);
  localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  localStorage.removeItem(STORAGE_KEYS.SELECTED_FOLDER_NAME);
  localStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETED);
}
