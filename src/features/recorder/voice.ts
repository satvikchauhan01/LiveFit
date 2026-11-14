import * as Speech from 'expo-speech';

/**
 * Says something out loud with the phone's text-to-speech voice. It works with
 * the screen off because the recording's foreground service keeps the app running.
 */
export function speak(text: string): void {
  try {
    Speech.speak(text);
  } catch (error) {
    console.warn('[voice] could not speak', error);
  }
}
