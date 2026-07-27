const SOUND_KEY = 'adega_order_sound';

export function isOrderSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_KEY) !== 'off';
}

export function setOrderSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off');
}
