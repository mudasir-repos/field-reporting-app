import { Image, Text, View } from 'react-native';
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
}

function ReportCard({
  title,
  imageCount,
  date,
  imagePaths = [],
  imageUrls = [],
  uploadStatus,
}: ReportCardProps) {
  const statusDisplay = uploadStatus ? uploadStatusConfig[uploadStatus] : null;

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
            <Text style={[styles.statusText, { color: statusDisplay.color }]}>
              {statusDisplay.label}
            </Text>
          </View>
        )}
      </View>

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
      </View>

      <Text style={styles.description}>
        {isServerReport ? 'Received by server' : 'Saved on this device'}
      </Text>
    </View>
  );
}

export default ReportCard;
