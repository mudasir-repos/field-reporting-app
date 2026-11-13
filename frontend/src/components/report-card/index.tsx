import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { UploadStatus } from '../../types';
import { uploadStatusConfig } from '../../utils/constant';
import { styles } from './styles';

interface ReportCardProps {
  title: string;
  imageCount: number;
  date: string;
  // Local queue cards pass local file paths (file:// URIs).
  imagePaths?: string[];
  // Server report cards pass full HTTP image URLs.
  imageUrls?: string[];
  // Only queue cards have an upload status badge.
  uploadStatus?: UploadStatus;
  // Error message from the last upload attempt (if failed).
  lastError?: string | null;
  // Number of upload attempts so far.
  uploadAttempts?: number;
  // Callback when user taps to retry a failed upload.
  onRetry?: () => void;
}

function ReportCard({
  title,
  imageCount,
  date,
  imagePaths = [],
  imageUrls = [],
  uploadStatus,
  lastError,
  uploadAttempts,
  onRetry,
}: ReportCardProps) {
  const statusDisplay = uploadStatus ? uploadStatusConfig[uploadStatus] : null;
  const isUploading = uploadStatus === UploadStatus.UPLOADING;
  const isFailed = uploadStatus === UploadStatus.FAILED;

  // Use server URLs when available, otherwise fall back to local file paths.
  const displayImages = imageUrls.length > 0 ? imageUrls : imagePaths;

  // True when this card represents a report from the server (All Reports tab).
  const isServerReport = imageUrls.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        {statusDisplay && (
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusDisplay.background },
            ]}
          >
            {isUploading && (
              <ActivityIndicator
                size="small"
                color={statusDisplay.color}
                style={styles.badgeSpinner}
              />
            )}
            <Text style={[styles.statusText, { color: statusDisplay.color }]}>
              {statusDisplay.label}
            </Text>
          </View>
        )}
      </View>

      {/* Progress indicator while uploading */}
      {isUploading && (
        <View style={styles.uploadProgressRow}>
          <ActivityIndicator size="small" color="#1D4ED8" />
          <Text style={styles.uploadProgressText}>Uploading to server…</Text>
        </View>
      )}

      {displayImages.length > 0 && (
        <View style={styles.imageContainer}>
          {displayImages.map((imageUri, index) => (
            <Image
              key={`${imageUri}-${index}`}
              source={{ uri: imageUri }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ))}
        </View>
      )}

      <View style={styles.metadata}>
        <Text style={styles.metadataText}>
          {imageCount} {imageCount === 1 ? 'photo' : 'photos'}
        </Text>

        <View style={styles.dot} />

        <Text style={styles.metadataText}>{date}</Text>

        {uploadAttempts !== undefined && uploadAttempts > 0 && uploadStatus && (
          <>
            <View style={styles.dot} />
            <Text style={styles.metadataText}>
              {uploadAttempts} {uploadAttempts === 1 ? 'attempt' : 'attempts'}
            </Text>
          </>
        )}
      </View>

      <Text style={styles.description}>
        {isServerReport ? 'Received by server' : 'Saved on this device'}
      </Text>

      {/* Truncated 1-line lastError text below the card */}
      {isFailed && lastError ? (
        <Text style={styles.errorText} numberOfLines={1} ellipsizeMode="tail">
          Error: {lastError}
        </Text>
      ) : null}

      {/* Tap to retry affordance when failed */}
      {isFailed && onRetry ? (
        <Pressable
          style={styles.retryButton}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry uploading report"
        >
          <Text style={styles.retryButtonText}>Tap to retry upload</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default ReportCard;
