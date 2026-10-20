import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export type ImageSource = 'camera' | 'library';

export type PickResult =
  | { status: 'ok'; uri: string; width: number; height: number }
  | { status: 'cancelled' }
  | { status: 'denied' };

/**
 * Lets the user pick (or take) a photo, crops it square with the system editor,
 * then resizes to `size`px and compresses to JPEG. A typical avatar ends up ~60–120 KB.
 */
export async function pickSquareImage(source: ImageSource, size = 512): Promise<PickResult> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  };
  const picked =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (picked.canceled || !picked.assets[0]) return { status: 'cancelled' };

  const asset = picked.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > size || asset.height > size) context.resize({ width: size, height: size });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
  return { status: 'ok', uri: saved.uri, width: saved.width, height: saved.height };
}

/** Reads a local file URI into an ArrayBuffer for upload to Supabase Storage. */
export async function readAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return await response.arrayBuffer();
}
