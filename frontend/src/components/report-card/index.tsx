import { Text, View } from 'react-native';
import { styles } from './styles';
import { UploadStatus } from '../../types';
import { uploadStatusConfig } from '../../utils/constant';

interface ReportCardProps {
  title: string;
  imageCount: number;
  date: string;
  uploadStatus?: UploadStatus;
  reviewStatus?: string;
}

function ReportCard({
  title,
  imageCount,
  date,
  uploadStatus,
  reviewStatus,
}: ReportCardProps) {
  const status = uploadStatus ? uploadStatusConfig[uploadStatus] : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        {status && (
          <View
            style={[styles.statusBadge, { backgroundColor: status.background }]}
          >
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.metadata}>
        <Text style={styles.metadataText}>
          {imageCount} {imageCount === 1 ? 'photo' : 'photos'}
        </Text>

        <View style={styles.dot} />

        <Text style={styles.metadataText}>{date}</Text>
      </View>

      {uploadStatus && (
        <Text style={styles.description}>Saved on this device</Text>
      )}

      {reviewStatus && (
        <Text style={styles.description}>Review status: {reviewStatus}</Text>
      )}
    </View>
  );
}

export default ReportCard;
