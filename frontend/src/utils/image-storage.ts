import RNBlobUtil from 'react-native-blob-util';
import type { Asset } from 'react-native-image-picker';

const { DocumentDir } = RNBlobUtil.fs.dirs;

const REPORTS_DIRECTORY = `${DocumentDir}/reports`;

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function normalizeFilePath(uri: string): string {
  return uri.replace(/^file:\/\//, '');
}

async function ensureDirectoryExists(directory: string): Promise<void> {
  const exists = await RNBlobUtil.fs.exists(directory);

  if (!exists) {
    await RNBlobUtil.fs.mkdir(directory);
  }
}

export async function saveReportImages(
  reportId: string,
  images: Asset[],
): Promise<Asset[]> {
  if (!reportId.trim()) {
    throw new Error('A valid report ID is required.');
  }

  if (images.length === 0) {
    return [];
  }

  // Prevent report IDs from introducing unexpected paths.
  const safeReportId = sanitizeFileName(reportId);

  const reportDirectory = `${REPORTS_DIRECTORY}/${safeReportId}`;

  const copiedFiles: string[] = [];

  try {
    await ensureDirectoryExists(REPORTS_DIRECTORY);
    await ensureDirectoryExists(reportDirectory);

    const savedImages: Asset[] = [];

    for (const [index, image] of images.entries()) {
      if (!image.uri) {
        throw new Error(`Image ${index + 1} does not have a valid URI.`);
      }

      const sourcePath = normalizeFilePath(image.uri);

      const sourceExists = await RNBlobUtil.fs.exists(sourcePath);

      if (!sourceExists) {
        throw new Error(`Image ${index + 1} could not be found.`);
      }

      const originalFileName =
        image.fileName || `report-image-${index + 1}.jpg`;

      const safeFileName = sanitizeFileName(originalFileName);

      const destinationPath = `${reportDirectory}/${index + 1}-${safeFileName}`;

      await RNBlobUtil.fs.cp(sourcePath, destinationPath);

      copiedFiles.push(destinationPath);

      savedImages.push({
        ...image,
        uri: `file://${destinationPath}`,
        fileName: `${index + 1}-${safeFileName}`,
      });
    }

    return savedImages;
  } catch (error) {
    // Clean up partially copied images if saving fails.
    for (const filePath of copiedFiles) {
      try {
        await RNBlobUtil.fs.unlink(filePath);
      } catch {
        // Preserve the original error.
      }
    }

    throw error;
  }
}

export async function deleteReportImages(reportId: string): Promise<void> {
  if (!reportId.trim()) {
    throw new Error('A valid report ID is required.');
  }

  const safeReportId = sanitizeFileName(reportId);

  const reportDirectory = `${REPORTS_DIRECTORY}/${safeReportId}`;

  const exists = await RNBlobUtil.fs.exists(reportDirectory);

  if (exists) {
    await RNBlobUtil.fs.unlink(reportDirectory);
  }
}
