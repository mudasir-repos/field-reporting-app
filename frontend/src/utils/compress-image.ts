import ImageResizer from '@bam.tech/react-native-image-resizer';
import type { Asset } from 'react-native-image-picker';

const MAX_IMAGE_SIZE_BYTES = 4.5 * 1024 * 1024;

const COMPRESSION_ATTEMPTS = [
  { maxDimension: 2048, quality: 80 },
  { maxDimension: 1600, quality: 70 },
  { maxDimension: 1280, quality: 60 },
  { maxDimension: 1024, quality: 50 },
];

export async function compressImage(asset: Asset): Promise<Asset> {
  if (!asset.uri) {
    throw new Error('The selected image does not have a valid URI.');
  }

  let sourceUri = asset.uri;

  for (const attempt of COMPRESSION_ATTEMPTS) {
    const result = await ImageResizer.createResizedImage(
      sourceUri,
      attempt.maxDimension,
      attempt.maxDimension,
      'JPEG',
      attempt.quality,
      0,
      undefined,
      false,
      {
        mode: 'contain',
        onlyScaleDown: true,
      },
    );

    if (result.size <= MAX_IMAGE_SIZE_BYTES) {
      return {
        ...asset,
        uri: result.uri,
        fileName: result.name || `report-image-${Date.now()}.jpg`,
        type: 'image/jpeg',
        fileSize: result.size,
        width: result.width,
        height: result.height,
      };
    }

    // Use the previous compressed output for the next attempt.
    sourceUri = result.uri;
  }

  throw new Error(
    'Unable to compress this image below 4.5 MB. Please select another image.',
  );
}
